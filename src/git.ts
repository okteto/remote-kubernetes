import * as vscode from 'vscode';
import gitRemoteOriginUrl from 'git-remote-origin-url';
import gitUrlParse from 'git-url-parse';

export async function getCurrentRepo() {
  try {
    const remote = await gitRemoteOriginUrl(vscode.workspace.rootPath);
    return remote;
  } catch(err) {
    return null;
  }
}

export function isSameRepository(url1: string, url2: string) {
  try {
    const repo1 = gitUrlParse(url1);
    const repo2 = gitUrlParse(url2);
    return repo1.owner === repo2.owner && repo1.name === repo2.name;
  } catch(err) {
    return false;
  }
}