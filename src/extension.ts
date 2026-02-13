'use strict';

import * as vscode from 'vscode';
import * as manifest from './manifest';
import * as path from 'path';
import * as ssh from './ssh';
import {sortFilePaths} from  './paths';
import * as okteto from './okteto';
import {Reporter, events} from './telemetry';
import { minimum } from './download';
import { initializeLogger, getLogger } from './logger';

const activeManifest = new Map<string, vscode.Uri>();
let reporter: Reporter;

const supportedDeployFilenames = ['okteto-pipeline.yml',
'okteto-pipeline.yaml',
'docker-compose.yml',
'docker-compose.yaml',
'okteto.yml', 
'okteto.yaml']

const supportedUpFilenames = [
'docker-compose.yml',
'docker-compose.yaml',
'okteto.yml', 
'okteto.yaml']
  
vscode.commands.executeCommand('setContext', 'ext.supportedDeployFiles', supportedDeployFilenames);
vscode.commands.executeCommand('setContext', 'ext.supportedUpFilenames', supportedUpFilenames);

function getExtensionVersion() : string {
    let version = "0.0.0";
    const ex = vscode.extensions.getExtension('okteto.remote-kubernetes');
    if (ex) {
        version = ex.packageJSON.version;
    }

    return version;
}

/**
 * Activates the Okteto VS Code extension.
 * Initializes the logger, telemetry reporter, and registers all commands.
 * @param context - The VS Code extension context
 */
export function activate(context: vscode.ExtensionContext) {
    const version = getExtensionVersion();

    const logger = initializeLogger();
    context.subscriptions.push(logger);

    logger.info(`okteto.remote-kubernetes ${version} activated`);

    const ctx = okteto.getContext();
    const machineId = okteto.getMachineId();
    reporter = new Reporter(version, ctx.id, machineId);


    context.subscriptions.push(vscode.commands.registerCommand('okteto.up', upCmd));
    context.subscriptions.push(vscode.commands.registerCommand('okteto.down', downCmd));
    context.subscriptions.push(vscode.commands.registerCommand('okteto.test', testCmd));
    context.subscriptions.push(vscode.commands.registerCommand('okteto.install', installCmd));
    context.subscriptions.push(vscode.commands.registerCommand('okteto.deploy', deployCmd));
    context.subscriptions.push(vscode.commands.registerCommand('okteto.destroy', destroyCmd));
    context.subscriptions.push(vscode.commands.registerCommand('okteto.context', contextCmd));
    context.subscriptions.push(vscode.commands.registerCommand('okteto.namespace', namespaceCmd));

    reporter.track(events.activated);

}

/**
 * Deactivates the Okteto VS Code extension.
 * Clears the active manifest map and disposes of resources.
 */
export function deactivate() {
    activeManifest.clear();
    if (reporter) {
        reporter.dispose();
    }
}

async function checkPrereqs(checkContext: boolean) {
    const { install, upgrade } = await okteto.needsInstall();
    if (install) {
        await installCmd(upgrade, false);
    }

    if (!checkContext) {
        return
    }

    const ctx = okteto.getContext();
    if (ctx.id === '') {
        await contextCmd();
    }
}

async function installCmd(upgrade: boolean, handleErr: boolean) {
    let title = `Installing Okteto ${minimum}`;
    let success = `Okteto was successfully installed`;
    
    if (upgrade) {
        title = "Okteto is out of date, upgrading";
        success = `Okteto was successfully upgraded`;
    }

    getLogger().info('installing okteto');
    reporter.track(events.install);
    await vscode.window.withProgress(
      {location: vscode.ProgressLocation.Notification, title: title},
      async (progress) => {
        try {

            await okteto.install(progress);
        } catch(err: unknown) {
            getLogger().error(`${getErrorMessage(err)}`)
            reporter.track(events.oktetoInstallFailed);
            reporter.captureError(`okteto install failed: ${getErrorMessage(err)}`, err);
            if (handleErr) {
                vscode.window.showErrorMessage(`Okteto was not installed: ${getErrorMessage(err)}`);
            } else {
                throw new Error(`Okteto was not installed: ${getErrorMessage(err)}`);
            }
            
        }
      },
    );

    vscode.window.showInformationMessage(success);
}

async function upCmd() {
    try{
        await checkPrereqs(true);
    } catch(err: unknown) {   
        vscode.window.showErrorMessage(getErrorMessage(err));    
        return;
    }

    reporter.track(events.up);

    const manifestUri = await showManifestPicker(supportedUpFilenames);
    if (!manifestUri) {
        reporter.track(events.manifestDismissed);
        return;
    }

    reporter.track(events.manifestSelected);
    const manifestPath = manifestUri;
    getLogger().debug(`user selected: ${manifestPath.fsPath}`);

    let m: manifest.Manifest;

    try {
        m = await manifest.get(manifestPath);
    } catch(err: unknown) {
        reporter.track(events.manifestLoadFailed);
        reporter.captureError(`load manifest failed: ${getErrorMessage(err)}`, err);
        return onOktetoFailed(`Okteto: Up failed to load your Okteto manifest: ${getErrorMessage(err)}`);
    }


    let service: manifest.Service;

    if (m.services.length === 1) {
        service = m.services[0];
    } else {
        const choice = await showManifestServicePicker(m.services);
        if (!choice) {
            reporter.track(events.manifestDismissed);
            return;
        }

        service = choice;
    }

    const namespace = await getNamespace();

    let port = service.port;
    if (port === 0 || port === undefined) {
        try {
            port = await ssh.getPort();
        } catch(err: unknown) {
            reporter.track(events.sshPortFailed);
            reporter.captureError(`ssh.getPort failed: ${getErrorMessage(err)}`, err);
            return onOktetoFailed(`Okteto: Up failed to find an available port: ${getErrorMessage(err)}`, `${namespace}-${service.name}`);
        }
    }    

    okteto.up(manifestPath, namespace, service.name, port);
    activeManifest.set(manifestUri.fsPath, manifestUri);

    try{
        await waitForUp(namespace, service.name, port);
    } catch(err: unknown) {
        reporter.captureError(`okteto up failed: ${getErrorMessage(err)}`, err);
        return onOktetoFailed(getErrorMessage(err), `${namespace}-${service.name}`);
    }

    await finalizeUp(namespace,service.name, service.workdir);
}

async function waitForUp(namespace: string, name: string, port: number) {
    await vscode.window.withProgress(
        {location: vscode.ProgressLocation.Notification, cancellable: true },
          async (progress, token) => {
              token.onCancellationRequested(() => {
                  reporter.track(events.upCancelled);
                  vscode.commands.executeCommand('okteto.down');
              });

              const result = await waitForFinalState(namespace, name, progress);
              if (!result.result) {
                  reporter.track(events.oktetoUpFailed);
                  getLogger().error(result.message);
                  throw new Error(`Okteto: Up command failed: ${result.message}`);
              }

              try {
                  await ssh.isReady(port);
              } catch(err: unknown) {
                  reporter.track(events.sshServiceFailed);
                  reporter.captureError(`SSH wasn't available after 60 seconds: ${getErrorMessage(err)}`, err);
                  throw new Error(`Okteto: Up command failed, SSH server wasn't available after 60 seconds`);
              }
          });
}

async function waitForFinalState(namespace: string, name:string, progress: vscode.Progress<{message?: string | undefined; increment?: number | undefined}>): Promise<{result: boolean, message: string}> {
    const config = vscode.workspace.getConfiguration('okteto');
    let upTimeout = 1000;
    if (config) {
        upTimeout = config.get<number>('timeout') || 1000;
    }
    
    const seen = new Map<string, boolean>();
    const messages = okteto.getStateMessages();
    progress.report({  message: "Launching your development environment..." });
    let counter = 0;
    const timeout = 15 * 60;
    while (true) {
        const res = await okteto.getState(namespace, name);
        if (!seen.has(res.state)) {
            progress.report({ message: messages.get(res.state) });
            getLogger().debug(`okteto is ${res.state}`);
        }

        seen.set(res.state, true);
        switch(res.state){
            case okteto.state.ready:
                return {result: true, message: ''};
            case okteto.state.failed:
                return {result: false, message: res.message};
            case okteto.state.starting: {
                const isRunning = await okteto.isRunning(namespace, name);
                if (!isRunning && counter > upTimeout){
                    return {result: false, message: `process failed to start`};
                }
                break;
            }
        }
        
        counter++;
        if (counter === timeout) {
            return {result: false, message: `task didn't finish in 5 minutes`};
        }
        
        await sleep(1000);
    }
}

async function sleep(ms: number) {
    return new Promise<void>(resolve => setTimeout(resolve, ms));
}

async function finalizeUp(namespace: string, name: string, workdir: string) {
    reporter.track(events.upReady);
    const remoteSSH = okteto.getRemoteSSH();

    if (!remoteSSH) {
        reporter.track(events.upFinished);
        okteto.showTerminal(`${namespace}-${name}`);
        return;
    }

    try {
        const host = `${name}.okteto`;
        const uri = vscode.Uri.parse(`vscode-remote://ssh-remote+${host}/${workdir}`);
        await vscode.commands.executeCommand('vscode.openFolder', uri, true);
        reporter.track(events.upFinished);
        okteto.notifyIfFailed(namespace, name, onOktetoFailed);
    } catch(err: unknown) {
        reporter.captureError(`opensshremotes.openEmptyWindow failed: ${getErrorMessage(err)}`, err);
        reporter.track(events.sshHostSelectionFailed);
        return onOktetoFailed(`Okteto: Up failed to open the host selector: ${getErrorMessage(err)}`, `${namespace}-${name}`);
    }
}

async function downCmd() {
    try{
        await checkPrereqs(true);
    } catch(err: unknown) {   
        vscode.window.showErrorMessage(getErrorMessage(err));    
        return;
    }

    reporter.track(events.down);
    const manifestPath = await getManifestOrAsk();
    if (!manifestPath) {
        return;
    }

    let m: manifest.Manifest;
    
    try {
        m = await manifest.get(manifestPath);
    } catch(err: unknown) {
        reporter.track(events.manifestLoadFailed);
        reporter.captureError(`load manifest failed: ${getErrorMessage(err)}`, err);
        return onOktetoFailed(`Okteto: Down failed to load your Okteto manifest: ${getErrorMessage(err)}`);
    }

    let service: manifest.Service;

    if (m.services.length === 1 ) {
        service = m.services[0];
    } else {
        const choice = await showManifestServicePicker(m.services);
        if (!choice) {
            return;
        }

        service = choice;
    }
    

    const ctx = okteto.getContext();
    

    try {
        await okteto.down(manifestPath, ctx.namespace, service.name);
        activeManifest.delete(manifestPath.fsPath);
        vscode.window.showInformationMessage("Okteto environment deactivated");
        reporter.track(events.downFinished);
    } catch(err: unknown) {
        reporter.track(events.oktetoDownFailed);
        reporter.captureError(`okteto down failed: ${getErrorMessage(err)}`, err);
        vscode.window.showErrorMessage(`Okteto: Down failed: ${getErrorMessage(err)}`);
    }
}

async function deployCmd() {
    try{
        await checkPrereqs(true);
    } catch(err: unknown) {   
        vscode.window.showErrorMessage(getErrorMessage(err));    
        return;
    }

    const manifestUri = await showManifestPicker(supportedDeployFilenames);
    if (!manifestUri) {
        reporter.track(events.manifestDismissed);
        return;
    }

    reporter.track(events.manifestSelected);
    const manifestPath = manifestUri.fsPath;
    getLogger().debug(`user selected: ${manifestPath}`);

    try {
        const namespace = await getNamespace();
        reporter.track(events.deploy);
        await okteto.deploy(namespace, manifestPath);
    } catch(err: unknown) {
        reporter.captureError(`okteto deploy failed: ${getErrorMessage(err)}`, err);
        vscode.window.showErrorMessage(`Okteto: Deploy failed: ${getErrorMessage(err)}`);
    }
}

async function testCmd() {
    try{
        await checkPrereqs(true);
    } catch(err: unknown) {   
        vscode.window.showErrorMessage(getErrorMessage(err));    
        return;
    }

    const manifestUri = await showManifestPicker(supportedUpFilenames);
    if (!manifestUri) {
        reporter.track(events.manifestDismissed);
        return;
    }

    reporter.track(events.manifestSelected);
    const manifestPath = manifestUri;
    getLogger().debug(`user selected: ${manifestPath}`);

    let m: manifest.Manifest;
    
    try {
        m = await manifest.get(manifestPath);
    } catch(err: unknown) {
        reporter.track(events.manifestLoadFailed);
        reporter.captureError(`load manifest failed: ${getErrorMessage(err)}`, err);
        return onOktetoFailed(`Okteto: Down failed to load your Okteto manifest: ${getErrorMessage(err)}`);
    }

    try {
        const test = await showManifestTestPicker(m.tests);
        if (!test) {
            return;
        }

        const namespace = await getNamespace();
        reporter.track(events.test);
        await okteto.test(namespace, manifestPath.fsPath, test.name);
    } catch(err: unknown) {
        reporter.captureError(`okteto test failed: ${getErrorMessage(err)}`, err);
        vscode.window.showErrorMessage(`Okteto: Test failed: ${getErrorMessage(err)}`);
    }
}

async function destroyCmd() {
    try{
        await checkPrereqs(true);
    } catch(err: unknown) {   
        vscode.window.showErrorMessage(getErrorMessage(err));    
        return;
    }

    const manifestUri = await showManifestPicker(supportedDeployFilenames);
    if (!manifestUri) {
        reporter.track(events.manifestDismissed);
        return;
    }

    reporter.track(events.manifestSelected);
    getLogger().debug(`user selected: ${manifestUri.fsPath}`);

    reporter.track(events.destroy);
    try {
        const namespace = await getNamespace();
        await okteto.destroy(namespace, manifestUri);
    } catch(err: unknown) {
        reporter.captureError(`okteto destroy failed: ${getErrorMessage(err)}`, err);
        vscode.window.showErrorMessage(`Okteto: Destroy failed: ${getErrorMessage(err)}`);
    }
}

async function getManifestOrAsk(): Promise<vscode.Uri | undefined> {
    if (activeManifest.size > 0) {
        if (activeManifest.size === 1) {
            const manifestUri = activeManifest.values().next().value;
            return manifestUri;
        } else {
          const manifestUri = await showActiveManifestPicker();
          if (manifestUri) {
            reporter.track(events.manifestSelected);
            return manifestUri;
          } else {
            reporter.track(events.manifestDismissed);
          }
        }
    } else {
        const manifestUri = await showManifestPicker(supportedUpFilenames);
        if (manifestUri) {
            reporter.track(events.manifestSelected);
            return manifestUri;
        } else {
            reporter.track(events.manifestDismissed);
        }
    }
}

/**
 * Gets the default location for an Okteto manifest file.
 * Returns the path to 'okteto.yml' in the first workspace folder, if available.
 * @returns The URI of the default manifest location, or undefined if no workspace is open
 */
export function getDefaultLocationManifest(): vscode.Uri | undefined{
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
        return undefined;
    }

    const p = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'okteto.yml');
    const loc = vscode.Uri.file(p);
    getLogger().debug(`default location: ${loc.fsPath.toString()}`);
    return loc;
}

async function contextCmd(){
    try{
        await checkPrereqs(false);
    } catch(err: unknown) {   
        vscode.window.showErrorMessage(getErrorMessage(err));    
        return;
    }

    reporter.track(events.context);
    const choice = await vscode.window.showQuickPick(okteto.getContextList(), {canPickMany: false, placeHolder: 'Select the context for all the Okteto commands'});
    if (!choice) {
        return;
    }

    let context = choice.value;
    if (choice.value === "create") {
        const create = await vscode.window.showInputBox({title: "Set the context for all the Okteto commands", prompt: "Specify an Okteto URL or a Kubernetes context name", placeHolder: "https://okteto.example.com"})
        if (!create) {
            return;
        }

        context = create;
    }

    const success = await okteto.setContext(context);
    if (success) {
        vscode.window.showInformationMessage('Your new context was set successfully');    
    } else {
        vscode.window.showErrorMessage('fail to set the context');    
        return;
    }

    const machineId = okteto.getMachineId();
    const ctx = okteto.getContext();
    reporter = new Reporter(getExtensionVersion(), ctx.id, machineId);
    reporter.track(events.activated);
}

async function namespaceCmd(){
    try{
        await checkPrereqs(true);
    } catch(err: unknown) {   
        vscode.window.showErrorMessage(getErrorMessage(err));    
        return;
    }

    reporter.track(events.namespace);
    const ns = await vscode.window.showInputBox({title: "Set the namespace for all the Okteto commands"})
    if (!ns) {
        return;
    }

    await okteto.setNamespace(ns);
}

function onOktetoFailed(message: string, terminalSuffix: string | null = null) {
    vscode.window.showErrorMessage(message);
    if (terminalSuffix) {
        okteto.showTerminal(terminalSuffix);
    }
}

async function showManifestPicker(supportedFilenames: string[] = supportedDeployFilenames) : Promise<vscode.Uri | undefined> {
    const files = await vscode.workspace.findFiles('**/{okteto,docker-compose,okteto-*,okteto.*}.{yml,yaml}', '**/node_modules/**');

    // Helper to check if filename matches deploy patterns
    const isDeployPattern = (filename: string): boolean => {
        // For deploy files, support wildcard patterns okteto-*.{yml,yaml} and okteto.*.{yml,yaml}
        if (supportedFilenames === supportedDeployFilenames) {
            return /^okteto-.*\.(yml|yaml)$/.test(filename) ||
                   /^okteto\..*\.(yml|yaml)$/.test(filename) ||
                   supportedFilenames.includes(filename);
        }
        // For up files, use exact match only
        return supportedFilenames.includes(filename);
    };

    // Filter files to only include supported filenames for this command
    const filteredFiles = files.filter(file => {
        const basename = path.basename(file.fsPath);
        return isDeployPattern(basename);
    });

    if (filteredFiles.length === 0) {
        await vscode.window.showErrorMessage(`No manifests found in your workspace.\n
Please run the 'Okteto: Create Manifest' command to create it and then try again.`, {
            modal: true
        });
        return;
    }

    if (filteredFiles.length === 1 ) {
        return filteredFiles[0];
    }

    const sortedFiles = sortFilePaths(filteredFiles);

    const items = sortedFiles.map(file => {
        return {
            label: vscode.workspace.asRelativePath(file, true),
            uri: file
        };
    });
    const manifestItem = await vscode.window.showQuickPick(items, {
        canPickMany: false,
        placeHolder: 'Select your okteto manifest'
    });
    return manifestItem ? manifestItem.uri : undefined;
}

async function showManifestServicePicker(services: manifest.Service[]) : Promise<manifest.Service | undefined>{
    
    const items = services.map(s => {
        return {
            label: s.name,
            service: s
        };
    });
    
    const serviceItem = await vscode.window.showQuickPick(items, {
        canPickMany: false,
        placeHolder: 'Select the service to develop'
    });


    return serviceItem ? serviceItem.service : undefined;
}

async function showManifestTestPicker(tests: manifest.Test[]) : Promise<manifest.Test | undefined>{
    
    const items = tests.map(t => {
        return {
            label: t.name,
            test: t
        };
    });

    items.push({label: "All tests", test: new manifest.Test("")})
    
    const testItem = await vscode.window.showQuickPick(items, {
        canPickMany: false,
        placeHolder: 'Select the test to run'
    });


    return testItem ? testItem.test : undefined;
}

interface ManifestQuickPickItem extends vscode.QuickPickItem {
    uri: vscode.Uri;
}

async function showActiveManifestPicker() : Promise<vscode.Uri | undefined> {
    const items: ManifestQuickPickItem[] = [];
    activeManifest.forEach((value, key ) => {
        items.push({
            label: key,
            uri: value
        });
    });



    const manifestItem = await vscode.window.showQuickPick(items, {
        canPickMany: false,
        placeHolder: 'Select your okteto active manifest'
    });
    return manifestItem ? manifestItem.uri : undefined;
}

async function getNamespace(): Promise<string> {
    const ctx = okteto.getContext();
    return ctx.namespace;
}

function getErrorMessage(err: unknown): string {
    if (err instanceof Error) {
        return err.message;
    }
    return String(err);
}