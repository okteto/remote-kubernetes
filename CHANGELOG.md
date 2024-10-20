# Change Log

## 0.5.1
- Updated minimum required Okteto CLI version to 2.29.3
- Removed `okteto.create` command
- Update dependencies to latest available major version

## 0.4.15
- Updated minimum required Okteto CLI version to 2.29.3
- Updated dependencies  

## 0.4.14
- Updated minimum required Okteto CLI version to 2.28.0
- Updated dependencies

## 0.4.13
- Update minimum required Okteto CLI version to 2.25.4

## 0.4.12
- Update minimum required Okteto CLI version to 2.23.1

## 0.4.11
- Update to Okteto CLI 2.21.0
- Fix issue when doing a clean installation of the okteto cli
- Improved error messages
- Updated dependencies
- Removed TSLint in favor of ESLint

## 0.4.10
- Update to Okteto CLI 2.18.0
- Fixed issue that prevented telemetry from being properly disabled

## 0.4.9
- Update to Okteto CLI 2.15.3

## 0.4.8
- Update to Okteto CLI 2.14.1
- Use `got` to download binary dependencies.

## 0.4.7
- Update to Okteto CLI 2.11.0
- Fix race condition when activating telemetry.

## 0.4.6
- Support docker-compose.yaml files
- Deploy and Destroy commands will ask the user to pick a file if there's more than one Okteto or docker-compose manifests in the root of the repository.
- Update minimum version to Okteto CLI 2.9.1.

## 0.4.5
- Update minimum version to Okteto CLI 2.9.0.
- Automatically pick the manifest if there's a single `okteto.yml` or `docker-compose.yml` file in the repository.
- Fix connectivity issue when using Remote-SSH mode. 
- Automatically calculate the `workdir` based on the sync folders if `workdir` is not declared in the manifest.

## 0.4.4
- Update minimum version to Okteto CLI 2.4.2.
- Add an optional parameter to increase the timeout of the okteto up command.

## 0.4.3
- Fix error with Windows Paths

## 0.4.2
- Fix error on the create manifest task
- Fix compatibility with v1 manifests

## 0.4.1
- Support for [Okteto CLI 2.0](https://www.okteto.com/blog/announcing-the-launch-of-okteto-cli-2-0/).
- You can know [set up a context](https://www.okteto.com/docs/reference/cli/#context) that will be applied to all commands, independently of your kubernetes context.
- New commands to deploy and delete your development environment, and to set the default namespace for Okteto commands.
- Option to enable/disable Remote-SSH mode.
- Enable SSH-RSA keys for the SSH host created by okteto.
- Handle $HOME directory with spaces correctly.
- Install the correct binary in ARM64 devices.
- Update dependencies.

## 0.3.4
- Update to okteto `1.13.10`
- Add custom icon to the terminal
- Build with Typescript 4

## 0.3.3
- Fix regression on `okteto up`

## 0.3.2
- Update to okteto `1.13.2`

## 0.3.1
- Update to okteto `1.13.1`

## 0.3.0
- Update to okteto `1.12.12`
- Update to syncthing `1.16`

## 0.2.1
- Update to okteto `1.12.5` to explicitly set `PubkeyAcceptedKeyTypes` in the SSH configuration.

## 0.2.0
- Support starting multiple `okteto up` from the same window.
- Update to okteto `1.10.5`.
- Update to syncthing `1.12.0`.
- Detect if `okteto up` crashes.

## 0.1.30
- Change the log level (and add other flags) to the `okteto up` via the `Up Flags` setting.
- Update to okteto `1.9.4`.
- Update to syncthing `1.10.0`.
- Update dependencies to next major version.

## 0.1.29
- Update to okteto `1.8.21` to fix synchronization issues reported by our users.

## 0.1.28
- Update to okteto `1.8.17`.
- Update to syncthing `1.8.0`.
- Update dependencies to next major version.

## 0.1.27
- Update to okteto `1.8.13`.
- Clean leftover syncthing processes

## 0.1.26
- Update to okteto `1.8.12`.
- Show more detail when `okteto up` fails.

## 0.1.25
- Update to okteto `1.8.11`.
- Correctly calculate $HOME for windows users with more than one drive.

## 0.1.24
- Update to okteto `1.8.9`.
- Update dependencies to next major version.
- `okteto down` won't show an error if there's an `up` active.
- Improved error reporting.

## 0.1.23
- Update to okteto `1.8.2` to upgrade to syncthing `1.4.0`.
- Fix issue with Windows install path.
- Update `webpack`.

## 0.1.22
- Update to okteto `1.8.0` to upgrade to syncthing `1.3.4` and improved monitoring.

## 0.1.21
- Update to okteto 1.7.4 to solve sync issues with okteto down.

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
