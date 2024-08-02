'use strict';

import * as mixpanel from 'mixpanel';
import * as vscode from 'vscode';
import * as os from 'os';
import * as sentry from '@sentry/node';

const dsn = 'https://3becafe2cb9040fe9b43a353a1f524c6@sentry.io/1802969';
const mpKey = '564133a36e3c39ecedf700669282c315';

export const events = {
    activated: 'activated',
    install: 'cmd_install',
    context: 'cmd_context',
    create: 'cmd_create',
    createFailed: 'cmd_create_failed',
    createOpenFailed: 'cmd_create_open_failed',
    createFinished: 'cmd_create_success',
    deploy: 'cmd_deploy',
    destroy: 'cmd_destroy',
    down: 'cmd_down',
    downFinished: 'cmd_down_success',
    namespace: "cmd_namespace",
    up: 'cmd_up',
    upCancelled: 'cmd_up_cancelled',
    upReady: 'cmd_up_ready',
    upFinished: 'cmd_up_success',
    oktetoDownFailed: 'okteto_down_failed',
    oktetoUpStartFailed: 'okteto_up_start_failed',
    oktetoUpFailed: 'okteto_up_failed',
    oktetoInitFailed: 'okteto_init_failed',
    oktetoInstallFailed: 'okteto_install_failed',
    manifestSelected: 'manifest_selected',
    manifestDismissed: 'manifest_select_dismissed',
    manifestLoadFailed: 'manifest_load_failed',
    sshPortFailed: 'ssh_get_port_failed',
    sshServiceFailed: 'ssh_service_failed',
    sshHostSelectionFailed: 'ssh_host_selection_failed',
  };

export class Reporter {
    private enabled: boolean = false;
    private distinctId: string;
    private machineId: string;
    private mp: mixpanel.Mixpanel;

    constructor(private extensionVersion: string, oktetoId: string, machineId: string) {
        this.mp = mixpanel.init(mpKey, {});
        this.machineId = machineId;
        
        const config = vscode.workspace.getConfiguration('okteto');
        const telemetry = config.get<boolean>('telemetry');
        if (config && telemetry != undefined) {
            this.enabled = telemetry;
        }

        if (oktetoId) {
            this.distinctId = oktetoId;
        } else if (machineId) {
            this.distinctId = machineId;
        } else {
            this.distinctId = vscode.env.machineId;
        }

        if (this.enabled) {
            let environment = 'prod';
            if (process.env.ENV === 'dev') {
                environment = 'dev';
                this.enabled = false;
            } 

            sentry.init({ 
                dsn:  dsn,
                integrations: defaults => defaults.filter(integration => (integration.name !== 'OnUncaughtException') && (integration.name !== 'OnUnhandledRejection')),
                environment: environment,
                release: `remote-kubernetes-vscode@${this.extensionVersion}`});

            const scope = sentry.getCurrentScope();
            scope.setUser({"id": this.distinctId});
            scope.setTags({
                'os': os.platform(),
                'version': this.extensionVersion,
                'vscodeversion': vscode.version,
                'session': vscode.env.sessionId,
                'vscode_machine_id': vscode.env.machineId,
                'machineId': machineId,
            });
            
        }

    }

    public track(event: string): Promise<void> {
      return new Promise<void>(resolve => {
          if (!this.enabled) {
              resolve();
              return;
          }

          if (!this.mp) {
            resolve();
            return;
          }

          this.mp.track(event, {
            distinct_id: this.distinctId,
            os: os.platform(),
            arch: os.arch(),
            release: os.release(),
            version: this.extensionVersion,
            vscodeversion: vscode.version,
            session: vscode.env.sessionId,
            vscode_machine_id: vscode.env.machineId,
            machine_id: this.machineId,
         }, (err)=> {
            if (err) {
                console.error(`failed to send telemetry: ${err}`);
                sentry.captureException(err);
            }

            resolve();
         });
      });
    }

    public captureError(message: string, err: any): Promise<void> {
        return new Promise<void>(resolve =>{
            console.error(message);
            if (this.enabled) {
                sentry.captureException(err);
            }

            resolve();
        });
    }
}