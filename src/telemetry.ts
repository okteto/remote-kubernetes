'use strict';

import * as mixpanel from 'mixpanel';
import * as vscode from 'vscode';
import * as os from 'os';

export const events = {
    activated: 'activated',
    install: 'cmd_install',
    create: 'cmd_create',
    createFailed: 'cmd_create_failed',
    createOpenFailed: 'cmd_create_open_failed',
    createFinished: 'cmd_create_success',
    down: 'cmd_down',
    downFinished: 'cmd_down_success',
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
    sshConfigFailed: 'ssh_config_update_failed',
    sshRemoveFailed: 'ssh_config_remove_failed',
    sshPortFailed: 'ssh_get_port_failed',
    sshServiceFailed: 'ssh_service_failed',
    sshHostSelectionFailed: 'ssh_host_selection_failed',
  };

export class Reporter {
    private enabled: boolean = true;
    private distinctId: string;
    private mp: mixpanel.Mixpanel;

    constructor(token: string, private extensionVersion: string, oktetoId: string) {
        this.mp = mixpanel.init(token);
        const config = vscode.workspace.getConfiguration('okteto');
        if (config) {
            this.enabled = config.get<boolean>('telemetry') || true;
        }

        if (oktetoId) {
            this.distinctId = oktetoId;
        } else {
            this.distinctId = vscode.env.machineId;
        }

    }

    public track(event: string) {
        if (!this.enabled) {
            return;
        }
        
        this.mp.track(event, {
            distinct_id: this.distinctId,
            os: os.platform(),
            version: this.extensionVersion,
            vscodeversion: vscode.version,
            session: vscode.env.sessionId,
            machine_id: vscode.env.machineId,
        }, (err)=> {
            if (err) {
                console.error(`failed to send telemetry: ${err}`);
            }
        });
    }

}