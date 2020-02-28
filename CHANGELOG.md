# Change Log

## 0.1.21
- Update to okteto 1.7.4 to solve sync issues with okteto down

## 0.1.20
- Fix issue with invalid yaml in the okteto manifest.

## 0.1.19
- Require Okteto `1.7.1`.
- Handle malformed kubeconfig files.
- Don't fail to load extension if machine ID can't be generated.
- Add timeout to long running tasks.
- Update dependencies.
 

## 0.1.18
- Require Okteto `1.6.5`.
- Customize the path to the kubeconfig if needed.

## 0.1.17
- Require Okteto `1.6.3`.
- Update dependencies.

## 0.1.15
- Calculate the correct paths when the namespace is defined in the manifest.
- Support `okteto.yml` and `okteto.yaml`.
- Require okteto `1.6.0`.

## 0.1.14
- Fix missing status message.

## 0.1.13
- Automatically open the correct folder in the remote environment.
- Run `okteto up` by right clicking on the `okteto.yml` file directly.

## 0.1.12
- Change dependency install location to `$HOME/.okteto` on OSX/Linux and `$HOME\AppData\Local\Programs`.
- Download the binaries directly from Github.

## 0.1.11
- `Git Bash mode` setting.

## 0.1.10
- Give the namespace in the manifest the highest priority.

## 0.1.9
- Capture errors if telemetry is enabled.
- Require okteto 1.5.3.
- Install the okteto binary in `%LOCALAPPDATA%` when in Windows.

## 0.1.8
- Include path to subdirectory in the manifest dialog.
- Update README and sample.
- Use port 22100 for remote SSH.

## 0.1.7
- Require okteto 1.5.1.
- New file picker to select the Okteto manifest.
- Improved error messages and reporting.


## 0.1.6
- Added `Okteto: Create manifest`command to initialize the Okteto manifest.

## 0.1.5
- Clean the SSH config when the terminal is disposed.
- Keep the selected manifest in memory instead of in the workspace state.
- Wait until the SSH server can handle connections.
- Automatically upgrade the okteto binary if not compatible with the plugin.

## 0.1.4
- Use `default` if there's no namespace defined in the context.

## 0.1.3
- On `Okteto: Up` failure, automatically open the terminal to show the user what went wrong.
- Set the `cwd` of the terminal to that of the okteto manifest.

## 0.1.2

- Initial release 🎉🎊.
- `Okteto: Install` command to install the Okteto binaries.
- `Okteto: Up command` to start a development environment in your Kubernetes cluster, create an entry in ssh-config and connect with the `Remote - SSH` extension.
- `Okteto: Down` command to clean everything up.
