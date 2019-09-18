# Troubleshooting

When running `Okteto: Up`, a terminal with the *okteto* label will be added to your list of terminals. This is where the process that manages your connection with Kubernetes is running. In case of error, that's the first place you should check.

The `Remote - Kubernetes` extension uses github.com/okteto/okteto behind the scenes to manage everything Kubernetes related. The log at `$HOME/.okteto/okteto.log` is another good place to check for issues. 

## Reach out

We're also in [Slack](https://kubernetes.slack.com/messages/CM1QMQGS0/) and [Twitter](https://twitter.com/oktetohq) in case you run into a bug, issue, or just want to talk about Kubernetes. See you there!