'use strict';

import * as fs from 'fs';
import * as os from 'os';
import got from'got';
import { pipeline } from 'stream/promises';
import path from 'path';
import * as vscode from 'vscode';
import { getLogger } from './logger';

/**
 * Minimum required Okteto CLI version.
 */
export const minimum = '3.16.0';

/**
 * Gets the platform-specific installation path for the Okteto CLI binary.
 * - Windows: %LOCALAPPDATA%\Programs\okteto.exe
 * - Unix: ~/.okteto-vscode/okteto
 * @returns The absolute path where Okteto CLI should be installed
 */
export function getInstallPath(): string {
    if (os.platform() === 'win32') {
      return path.join(os.homedir(), "AppData", "Local", "Programs", "okteto.exe");
    }

    return path.join(os.homedir(), '.okteto-vscode', 'okteto');
  }

/**
 * Gets the download URL and platform information for the Okteto CLI.
 * Determines the correct binary based on OS and architecture.
 * @returns Object with download URL and chmod flag indicating if the binary needs execute permissions
 */
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

  return {url:`https://downloads.okteto.com/cli/stable/${minimum}/${binaryName}`, chmod: chmod};
}

/**
 * Downloads the Okteto CLI binary from a URL to a destination path.
 * Reports download progress to the VS Code progress indicator.
 * @param source - The download URL
 * @param destination - The local file path where the binary should be saved
 * @param progress - VS Code progress reporter for showing download progress
 * @returns Promise that resolves to true when download completes successfully
 */
export async function binary(source: string, destination: string, progress: vscode.Progress<{increment: number, message: string}>) : Promise<boolean> { 
  const downloadStream = got.stream(source);
  const fileWriterStream = fs.createWriteStream(destination);
  let current = 0;
  downloadStream
    .on("downloadProgress", ({percent})=> {
      const percentage = Math.round(percent * 100);
      const reportedProgress = percentage - current;
      current = percentage;
      progress.report({increment: reportedProgress, message: ''});
    })
    .on("error", (error) => {
      getLogger().error(`Download failed: ${error.message}`);
    });

  fileWriterStream
  .on("error", (error) => {
    getLogger().error(`Could not write file to system: ${error.message}`);
  })
  .on("finish", () => {
    getLogger().info(`File downloaded to ${destination}`);
  });

  await pipeline(downloadStream, fileWriterStream);
  return true;
}

/**
 * Gets the Okteto CLI binary path.
 * Uses user-configured path from settings or defaults to the installation path.
 * @returns The path to the Okteto CLI binary
 */
export function getBinary(): string {
    const binary = vscode.workspace.getConfiguration('okteto').get<string>('binary');
    if (binary) {
      if (binary.trim().length > 0) {
        return binary;
      }
    }
  
    return getInstallPath();
  }
