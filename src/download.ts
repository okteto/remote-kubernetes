'use strict';

import * as fs from 'fs';
import * as os from 'os';
import * as vscode from 'vscode';
import * as https from 'https';
import * as path from 'path';

export const minimumVersion = '3.0.0';

export function getOktetoInstallPath(): string {
    if (os.platform() === 'win32') {
      return path.join(os.homedir(), "AppData", "Local", "Programs", "okteto.exe");
    }
  
    return path.join(os.homedir(), '.okteto-vscode', 'okteto');
  }

export function getOktetoDownloadInfo() : {url: string, chmod: boolean} {
  let chmod = true;
  let binaryName = "okteto.exe";

  switch(os.platform()){
    case 'win32':
      binaryName = `okteto.exe`;
      chmod = false;
      break;
    case 'darwin':
      switch(os.arch()){
        case 'arm64':
          binaryName = "okteto-Darwin-arm64"; 
          break;
        default:
          binaryName =  "okteto-Darwin-x86_64";
          break;
      }
      break;
    default:
      switch(os.arch()){
        case 'arm64':
          binaryName =  "okteto-Linux-arm64"; 
          break;
        default: 
          binaryName =  "okteto-Linux-x86_64";
          break;
      }
  }

  return {url:`https://downloads.okteto.com/cli/stable/${minimumVersion}/${binaryName}`, chmod: chmod};
}

export async function downloadBinary(sourceUrl: string, destinationPath: string, progress: vscode.Progress<{increment: number, message: string}>) : Promise<boolean> { 
  return new Promise((resolve, reject) => {
    const fileStream = fs.createWriteStream(destinationPath);

    https.get(sourceUrl, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download file: ${response.statusCode} ${response.statusMessage}`));
        return;
      }

      const totalBytes = parseInt(response.headers['content-length'] || '0', 10);
      response.on('data', (chunk) => {
        fileStream.write(chunk);
        const increment = (chunk.length / totalBytes) * 100;
        progress.report({increment: increment, message: ``});
      });

      response.on('end', () => {
        fileStream.end();
        console.log('Download completed');
        resolve(true);
      });

    }).on('error', (error) => {
      fs.unlink(destinationPath, () => {}); // Delete the file if download failed
      reject(error);
    });

    fileStream.on('error', (error) => {
      fs.unlink(destinationPath, () => {}); // Delete the file if there was an error
      reject(error);
    });
  });  
}

export function getBinaryPath(): string {
    let binary = vscode.workspace.getConfiguration('okteto').get<string>('binary');
    if (binary) {
      if (binary.trim().length > 0) {
        return binary;
      }
    }
  
    return getOktetoInstallPath();
  }
