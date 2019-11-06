# Change Log

## 0.1.10
- Add a setting to use OSX/Linux style file slashes in Windows.
- Give the namespace in the manifest the highest priority.

## 0.1.9
- Capture errors if telemetry is enabled.
- Require okteto 1.5.3.
- Install the okteto binary in %LOCALAPPDATA% when in Windows.

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
- Okteto: Install command to install the Okteto binaries.
- Okteto: Up command to start a development environment in your Kubernetes cluster, create an entry in ssh-config and connect with the `Remote - SSH` extension.
- Okteto: Down command to clean everything up.
