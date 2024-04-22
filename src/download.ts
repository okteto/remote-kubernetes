'use strict';

import * as fs from 'fs';
import * as os from 'os';
import got from'got';
import { pipeline } from 'stream';
import path from 'path';
import * as vscode from 'vscode';

export const minimum = '2.26.0';

export function getInstallPath(): string {
    if (os.platform() === 'win32') {
      return path.join(os.homedir(), "AppData", "Local", "Programs", "okteto.exe");
    }
  
    return path.join(os.homedir(), '.okteto-vscode', 'okteto');
  }

export function getOktetoUrl() : {url: string, chmod: boolean} {
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

  return {url:`https://downloads.okteto.com/cli/stable/${minimum}/${binaryName}`, chmod: chmod};
}

export async function binary(source: string, destination: string, progress: vscode.Progress<{increment: number, message: string}>) : Promise<boolean> { 
  const downloadStream = got.stream(source);
  const fileWriterStream = fs.createWriteStream(destination);
  var current = 0;
  downloadStream
    .on("downloadProgress", ({transferred, total, percent})=> {
      const percentage = Math.round(percent * 100);
      const reportedProgress = percentage - current;
      current = percentage;
      progress.report({increment: reportedProgress, message: ''});
    })
    .on("error", (error) => {
      console.error(`Download failed: ${error.message}`);
    });
  
  fileWriterStream
  .on("error", (error) => {
    console.error(`Could not write file to system: ${error.message}`);
  })
  .on("finish", () => {
    console.log(`File downloaded to ${destination}`);
  });

  return new Promise((resolve, reject) =>{
    pipeline(downloadStream, fileWriterStream, async(err)=>{
        if (err) {
            reject(err);
        } else {
            resolve(true);

        }
    });
  });    
}

export function getBinary(): string {
    let binary = vscode.workspace.getConfiguration('okteto').get<string>('binary');
    if (binary) {
      if (binary.trim().length > 0) {
        return binary;
      }
    }
  
    return getInstallPath();
  }
