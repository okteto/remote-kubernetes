'use strict';

import * as mixpanel from 'mixpanel';
import * as vscode from 'vscode';
import * as os from 'os';
import * as sentry from '@sentry/node';
import { getLogger } from './logger';

const dsn = 'https://3becafe2cb9040fe9b43a353a1f524c6@sentry.io/1802969';
const mpKey = '564133a36e3c39ecedf700669282c315';

/**
 * Telemetry event names for tracking user actions.
 * Used with Reporter.track() to log user interactions with the extension.
 */
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
    test: 'cmd_test',
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

/**
 * Telemetry reporter for Okteto extension.
 * Handles Sentry error reporting and Mixpanel event tracking.
 * Respects VS Code's telemetry settings and the extension's own telemetry setting.
 */
export class Reporter {
    private enabled: boolean = true;
    private distinctId: string;
    private machineId: string;
    private mp: mixpanel.Mixpanel;
    private telemetryListener: vscode.Disposable;

    /**
     * Creates a new telemetry reporter.
     * @param extensionVersion - Extension version for event tracking
     * @param oktetoId - Okteto context ID for user identification
     * @param machineId - Machine ID for anonymous tracking
     */
    constructor(private extensionVersion: string, oktetoId: string, machineId: string) {
        this.mp = mixpanel.init(mpKey, {});
        this.machineId = machineId;

        // Respect both the extension's own setting and VS Code's global telemetry setting
        const config = vscode.workspace.getConfiguration('okteto');
        const telemetry = config.get<boolean>('telemetry');
        if (config && telemetry !== undefined) {
            this.enabled = telemetry;
        }

        if (!vscode.env.isTelemetryEnabled) {
            this.enabled = false;
        }

        // Listen for VS Code global telemetry changes
        this.telemetryListener = vscode.env.onDidChangeTelemetryEnabled((enabled) => {
            if (!enabled) {
                this.enabled = false;
            }
        });

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


            sentry.withScope(scope =>{
                scope.setUser({"id": this.distinctId});
                scope.setTags({
                    'os': os.platform(),
                    'version': this.extensionVersion,
                    'vscodeversion': vscode.version,
                    'session': vscode.env.sessionId,
                    'vscode_machine_id': vscode.env.machineId,
                    'machineId': machineId,
                });
            });
        }

    }

    /**
     * Tracks a telemetry event.
     * Sends the event to Mixpanel if telemetry is enabled.
     * @param event - Event name from the events constant
     * @returns Promise that resolves when the event has been sent
     */
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
                getLogger().debug(`failed to send telemetry: ${err}`);
                sentry.captureException(err);
            }

            resolve();
         });
      });
    }

    /**
     * Captures an error for reporting.
     * Logs the error and sends it to Sentry if telemetry is enabled.
     * @param message - Human-readable error message
     * @param err - The error object to report
     */
    public captureError(message: string, err: unknown): void {
        getLogger().error(message);
        if (this.enabled) {
            sentry.captureException(err);
        }
    }

    /**
     * Disposes of the telemetry reporter.
     * Cleans up the telemetry change listener.
     */
    public dispose(): void {
        this.telemetryListener.dispose();
    }
}
