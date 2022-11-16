'use strict';

import * as vscode from 'vscode';
import * as manifest from './manifest';
import * as path from 'path';
import * as ssh from './ssh';

import * as okteto from './okteto';
import {Reporter, events} from './telemetry';

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

export function activate(context: vscode.ExtensionContext) {
    const version = getExtensionVersion();

    console.log(`okteto.remote-kubernetes ${version} activated`);
    
    context.subscriptions.push(vscode.commands.registerCommand('okteto.up', upCmd));
    context.subscriptions.push(vscode.commands.registerCommand('okteto.down', downCmd));
    context.subscriptions.push(vscode.commands.registerCommand('okteto.install', installCmd));
    context.subscriptions.push(vscode.commands.registerCommand('okteto.create', createCmd));
    context.subscriptions.push(vscode.commands.registerCommand('okteto.deploy', deployCmd));
    context.subscriptions.push(vscode.commands.registerCommand('okteto.destroy', destroyCmd));
    context.subscriptions.push(vscode.commands.registerCommand('okteto.context', contextCmd));
    context.subscriptions.push(vscode.commands.registerCommand('okteto.namespace', namespaceCmd));

    const ctx = okteto.getContext();
    const machineId = okteto.getMachineId();
    reporter = new Reporter(version, ctx.id, machineId);
    reporter.track(events.activated);
}

async function checkPrereqs(checkContext: boolean) {
    const { install, upgrade } = await okteto.needsInstall();
    if (install) {
        try {
            await installCmd(upgrade, false);
        } catch(err: any) {
            throw err;
        }
    }

    if (!checkContext) {
        return
    }

    const ctx = okteto.getContext();
    if (ctx.id === '') {
        try {
            await contextCmd();
        } catch(err: any) {
            throw err;
        }
    }
}

async function installCmd(upgrade: boolean, handleErr: boolean) {
    let title = `Installing Okteto ${okteto.minimum}`;
    let success = `Okteto was successfully installed`;
    
    if (upgrade) {
        title = "Okteto is out of date, upgrading";
        success = `Okteto was successfully upgraded`;
    }

    console.log('installing okteto');
    reporter.track(events.install);
    await vscode.window.withProgress(
      {location: vscode.ProgressLocation.Notification, title: title},
      async () => {
        try {
            await okteto.install();
        } catch(err: any) {
            reporter.track(events.oktetoInstallFailed);
            reporter.captureError(`okteto install failed: ${err.message}`, err);
            if (handleErr) {
                vscode.window.showErrorMessage(`Okteto was not installed: ${err.message}`);
            } else {
                throw new Error(`Okteto was not installed: ${err.message}`);
            }
            
        }
      },
    );

    vscode.window.showInformationMessage(success);
}

async function upCmd() {
    try{
        await checkPrereqs(true);
    } catch(err: any) {   
        vscode.window.showErrorMessage(err.message);    
        return;
    }

    reporter.track(events.up);

    const manifestUri = await showManifestPicker();
    if (!manifestUri) {
        reporter.track(events.manifestDismissed);
        return;
    }

    reporter.track(events.manifestSelected);
    const manifestPath = manifestUri.fsPath;
    console.log(`user selected: ${manifestPath}`);

    var manifests: manifest.Manifest[];

    try {
        manifests = await manifest.getManifests(manifestPath);
    } catch(err: any) {
        reporter.track(events.manifestLoadFailed);
        reporter.captureError(`load manifest failed: ${err.message}`, err);
        return onOktetoFailed(`Okteto: Up failed to load your Okteto manifest: ${err.message}`);
    }

    var m: manifest.Manifest;
    var serviceName = "";
    if (manifests.length == 1) {
        m = manifests[0];
    } else {
        const choice = await showManifestServicePicker(manifests);
        if (!choice) {
            reporter.track(events.manifestDismissed);
            return;
        }

        m = choice;
        serviceName = choice.name;
    }

    const ctx = okteto.getContext();
    if (!m.namespace) {
        if (ctx.namespace != "") {
            m.namespace = ctx.namespace;
        }
    }

    

    let port = m.port;
    if (port === 0 || port === undefined) {
        try {
            port = await ssh.getPort();
        } catch(err: any) {
            reporter.track(events.sshPortFailed);
            reporter.captureError(`ssh.getPort failed: ${err.message}`, err);
            return onOktetoFailed(`Okteto: Up failed to find an available port: ${err}`, `${m.namespace}-${m.name}`);
        }
    }    

    okteto.up(manifestPath, m.namespace, m.name, port, serviceName);
    activeManifest.set(`${m.namespace}-${m.name}`, manifestUri);

    try{
        await waitForUp(m.namespace, m.name, port);
    } catch(err: any) {
        reporter.captureError(`okteto up failed: ${err.message}`, err);
        return onOktetoFailed(err.message, `${m.namespace}-${m.name}`);
    }

    await finalizeUp(m.namespace,m.name, m.workdir);
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
                  console.error(result.message);
                  throw new Error(`Okteto: Up command failed: ${result.message}`);
              }

              try {
                  await ssh.isReady(port);
              } catch(err: any) {
                  reporter.track(events.sshServiceFailed);
                  reporter.captureError(`SSH wasn't available after 60 seconds: ${err.message}`, err);
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
    var counter = 0;
    var timeout = 15 * 60; // 5 minutes
    while (true) {
        const res = await okteto.getState(namespace, name);
        if (!seen.has(res.state)) {
            progress.report({ message: messages.get(res.state) });
            console.log(`okteto is ${res.state}`);
        }

        seen.set(res.state, true);
        switch(res.state){
            case okteto.state.ready:
                return {result: true, message: ''};
            case okteto.state.failed:
                return {result: false, message: res.message};
            case okteto.state.starting:
                const isRunning = await okteto.isRunning(namespace, name);
                if (!isRunning && counter > upTimeout){
                    return {result: false, message: `process failed to start`};
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
    return new Promise<void>(resolve =>  setTimeout(resolve, 1000));
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
    } catch(err: any) {
        reporter.captureError(`opensshremotes.openEmptyWindow failed: ${err.message}`, err);
        reporter.track(events.sshHostSelectionFailed);
        return onOktetoFailed(`Okteto: Up failed to open the host selector: ${err.message}`, `${namespace}-${name}`);
    }
}

async function downCmd() {
    try{
        await checkPrereqs(true);
    } catch(err: any) {   
        vscode.window.showErrorMessage(err.message);    
        return;
    }

    reporter.track(events.down);
    const manifestPath = await getManifestOrAsk();
    if (!manifestPath) {
        return;
    }

    let manifests: Array<manifest.Manifest>;
    
    try {
        manifests = await manifest.getManifests(manifestPath);
    } catch(err: any) {
        reporter.track(events.manifestLoadFailed);
        reporter.captureError(`load manifest failed: ${err.message}`, err);
        return onOktetoFailed(`Okteto: Down failed to load your Okteto manifest: ${err.message}`);
    }

    let m: manifest.Manifest;
    let serviceName = "";

    if (manifests.length == 1 ) {
        m = manifests[0];
    } else {
        const result = await showManifestServicePicker(manifests);
        if (!result) {
            return;
        }

        m = result;
        serviceName = m.name;
    }
    

    const ctx = okteto.getContext();
    if (!m.namespace) {
        if (ctx.namespace != "") {
            m.namespace = ctx.namespace;
        }
    }

    try {
        await okteto.down(manifestPath, m.namespace, m.name, serviceName);
        activeManifest.delete(`${m.namespace}-${m.name}`);
        vscode.window.showInformationMessage("Okteto environment deactivated");
        reporter.track(events.downFinished);
    } catch(err: any) {
        reporter.track(events.oktetoDownFailed);
        reporter.captureError(`okteto down failed: ${err.message}`, err);
        vscode.window.showErrorMessage(`Okteto: Down failed: ${err.message}`);
    }
}

async function deployCmd() {
    try{
        await checkPrereqs(true);
    } catch(err: any) {   
        vscode.window.showErrorMessage(err.message);    
        return;
    }
    
    const manifestUri = await showManifestPicker();
    if (!manifestUri) {
        reporter.track(events.manifestDismissed);
        return;
    }

    reporter.track(events.manifestSelected);
    const manifestPath = manifestUri.fsPath;
    console.log(`user selected: ${manifestPath}`);

    try {
        const ctx = okteto.getContext();
        var namespace = ctx.namespace;
        const m  = await manifest.getManifests(manifestPath);
        if (m.length > 0 && m[0].namespace){
            namespace = m[0].namespace;
        }

        reporter.track(events.deploy);
        await okteto.deploy(namespace, manifestPath);
    } catch(err: any) {
        reporter.captureError(`okteto deploy failed: ${err.message}`, err);
        vscode.window.showErrorMessage(`Okteto: Deploy failed: ${err.message}`);
    }
}

async function destroyCmd() {
    try{
        await checkPrereqs(true);
    } catch(err: any) {   
        vscode.window.showErrorMessage(err.message);    
        return;
    }

    const manifestUri = await showManifestPicker();
    if (!manifestUri) {
        reporter.track(events.manifestDismissed);
        return;
    }

    reporter.track(events.manifestSelected);
    const manifestPath = manifestUri.fsPath;
    console.log(`user selected: ${manifestPath}`);

    reporter.track(events.destroy);
    try {
        const ctx = okteto.getContext();
        var namespace = ctx.namespace;
        const m  = await manifest.getManifests(manifestPath);
        if (m.length > 0 && m[0].namespace){
            namespace = m[0].namespace;
        }

        await okteto.destroy(namespace, manifestPath);
    } catch(err: any) {
        reporter.captureError(`okteto destroy failed: ${err.message}`, err);
        vscode.window.showErrorMessage(`Okteto: Destroy failed: ${err.message}`);
    }
}

async function getManifestOrAsk(): Promise<string | undefined> {
    if (activeManifest.size > 0) {
        if (activeManifest.size === 1) {
            const manifestUri = activeManifest.values().next().value;
            return manifestUri.fsPath;
        } else {
          const manifestUri = await showActiveManifestPicker();
          if (manifestUri) {
            reporter.track(events.manifestSelected);
            return manifestUri.fsPath;
          } else {
            reporter.track(events.manifestDismissed);
          }
        }
    } else {
        const manifestUri = await showManifestPicker();
        if (manifestUri) {
            reporter.track(events.manifestSelected);
            return manifestUri.fsPath;
        } else {
            reporter.track(events.manifestDismissed);
        }
    }
}

export function getDefaultLocationManifest(): vscode.Uri | undefined{
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
        return undefined;
    }

    const p = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'okteto.yml');
    const loc = vscode.Uri.file(p);
    console.log(`default location: ${loc.fsPath.toString()}`);
    return loc;
}


async function createCmd(){
    try{
        await checkPrereqs(true);
    } catch(err: any) {   
        vscode.window.showErrorMessage(err.message);    
        return;
    }

    reporter.track(events.create);

    const manifestPath = getDefaultLocationManifest();
    if (!manifestPath) {
        reporter.track(events.createFailed);
        vscode.window.showErrorMessage(`Okteto: Create failed: Couldn't detect your project's path`);
        return;
    }

    try {
        await okteto.init(manifestPath);
    } catch(err: any) {
        reporter.track(events.oktetoInitFailed);
        reporter.captureError(`okteto init failed: ${err.message}`, err);
        vscode.window.showErrorMessage(`Okteto: Create failed: ${err}`);
        return;
    }

    try {
        await vscode.commands.executeCommand('vscode.openFolder', manifestPath);
    } catch (err: any) {
        reporter.track(events.createOpenFailed);
        reporter.captureError(`open folder failed ${err.message}`, err);
        vscode.window.showErrorMessage(`Okteto: Create failed: Couldn't open ${manifestPath}`);
        return;
    }
}

async function contextCmd(){
    try{
        await checkPrereqs(false);
    } catch(err: any) {   
        vscode.window.showErrorMessage(err.message);    
        return;
    }

    reporter.track(events.context);
    let choice = await vscode.window.showQuickPick(okteto.getContextList(), {canPickMany: false, placeHolder: 'Select the context for all the Okteto commands'});
    if (!choice) {
        return;
    }

    let context = choice.value;
    if (choice.value === "create") {
        const create = await vscode.window.showInputBox({title: "Set the context for all the Okteto commands", prompt: "Specify an Okteto URL or a Kubernetes context name", placeHolder: "https://cloud.okteto.com"})
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
    } catch(err: any) {   
        vscode.window.showErrorMessage(err.message);    
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

async function showManifestPicker() : Promise<vscode.Uri | undefined> {
    const files = await vscode.workspace.findFiles('**/{okteto,docker-compose,okteto-*}.{yml,yaml}', '**/node_modules/**');
    if (files.length === 0) {
        await vscode.window.showErrorMessage(`No manifests found in your workspace.\n
Please run the 'Okteto: Create Manifest' command to create it and then try again.`, {
            modal: true
        });
        return;
    }

    if (files.length === 1 ) {
        return files[0];
    }
    
    const items = files.map(file => {
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

async function showManifestServicePicker(manifests: manifest.Manifest[]) : Promise<manifest.Manifest | undefined>{
    
    const items = manifests.map(m => {
        return {
            label: m.name,
            manifest: m
        };
    });
    
    const manifestItem = await vscode.window.showQuickPick(items, {
        canPickMany: false,
        placeHolder: 'Select the service to develop'
    });


    return manifestItem ? manifestItem.manifest : undefined;
}

async function showActiveManifestPicker() : Promise<vscode.Uri | undefined> {
    const items: any[] = [];
    activeManifest.forEach((file, manifest) => {
        items.push({
            label: manifest,
            uri: file
        });
    });
    const manifestItem = await vscode.window.showQuickPick(items, {
        canPickMany: false,
        placeHolder: 'Select your okteto active manifest'
    });
    return manifestItem ? manifestItem.uri : undefined;
}
