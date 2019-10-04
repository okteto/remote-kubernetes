import * as mixpanel from 'mixpanel';
import * as vscode from 'vscode';
import * as os from 'os';

const extensionVersion = '0.1.5'; 
var reporter = mixpanel.init('564133a36e3c39ecedf700669282c315');
const enabled = vscode.workspace.getConfiguration('okteto').get<boolean>('telemetry');

export function track(event: string) {
    if (!enabled) {
        return;
    }

    reporter.track(event, {
        distinct_id: vscode.env.machineId,
        vscodeversion: vscode.version,
        os: os.platform(),
        version: extensionVersion
    }, (err)=> {
        if (err) {
            console.error(`failed to send analytics: ${err}`);
        }
    });
}