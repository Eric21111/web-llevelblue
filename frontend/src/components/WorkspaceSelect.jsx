export default function WorkspaceSelect({className = '', children, ...props}) {
  return <select {...props} className={('workspace-select ' + className).trim()}>{children}</select>;
}
