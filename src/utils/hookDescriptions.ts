/**
 * Detailed descriptions for each Claude Code hook type
 * Displayed as tooltips in the dashboard
 */

export const HOOK_DESCRIPTIONS: Record<string, { title: string; description: string }> = {
  SessionStart: {
    title: "Session Start",
    description: `Triggered when a Claude Code session begins. Use this to:
    • Initialize logging or monitoring
    • Set up local environment
    • Load preferences from configuration
    • Display welcome messages
    • Check system dependencies
    This is the first hook called in a new session.`,
  },
  UserPromptSubmit: {
    title: "User Prompt Submit",
    description: `Triggered when the user submits a prompt. Use this to:
    • Log user queries for analytics
    • Validate prompt content
    • Notify team members of new tasks
    • Route tasks to specific services
    • Check rate limits or usage
    This occurs after user input is received.`,
  },
  PreToolUse: {
    title: "Before Tool Execution",
    description: `Triggered before Claude uses any tool (Edit, Bash, etc). Use this to:
    • Play notification sounds for user awareness
    • Log tool usage for auditing
    • Validate tool parameters
    • Request permissions for sensitive operations
    • Display what action Claude is about to take
    This gives you a chance to intercept or warn before execution.`,
  },
  PermissionRequest: {
    title: "Permission Requested",
    description: `Triggered when Claude needs permission to proceed. Use this to:
    • Prompt user for approval
    • Log authorization requests
    • Implement custom permission policies
    • Integrate with access control systems
    • Send alerts for sensitive operations
    The hook handler determines if permission is granted.`,
  },
  PostToolUse: {
    title: "After Tool Execution",
    description: `Triggered after a tool executes successfully. Use this to:
    • Log tool results for auditing
    • Process output from executed commands
    • Trigger dependent actions
    • Update UI with progress
    • Send notifications of completion
    This is called only on successful execution.`,
  },
  PostToolUseFailure: {
    title: "Tool Execution Failed",
    description: `Triggered when a tool fails. Use this to:
    • Log errors for debugging
    • Play error notification sounds
    • Alert users of failures
    • Attempt retry logic
    • Clean up failed operations
    • Escalate critical failures
    This is called when a tool errors out.`,
  },
  Notification: {
    title: "Notification Event",
    description: `Triggered for various system notification events. Use this to:
    • Display notifications on screen
    • Play audio/visual alerts
    • Send desktop notifications (Windows Toast)
    • Log important events
    • Integrate with notification services
    • Send alerts to team channels
    This is the main hook for user-visible notifications.`,
  },
  SubagentStart: {
    title: "Subagent Started",
    description: `Triggered when a subagent task begins. Use this to:
    • Track subagent lifecycle
    • Log parallel task execution
    • Notify about background work
    • Set up resource monitoring
    • Track task dependencies
    Useful for understanding complex multi-task operations.`,
  },
  SubagentStop: {
    title: "Subagent Stopped",
    description: `Triggered when a subagent task completes. Use this to:
    • Clean up resources from subagent
    • Log task completion
    • Aggregate results from parallel tasks
    • Trigger next steps
    • Update progress tracking
    Complements SubagentStart for lifecycle management.`,
  },
  Stop: {
    title: "Session Stopped",
    description: `Triggered when Claude stops or pauses execution. Use this to:
    • Clean up resources
    • Save progress state
    • Generate summary reports
    • Send final notifications
    • Update dashboard status
    • Archive logs
    Called when user stops the session manually.`,
  },
  PreCompact: {
    title: "Before Context Compaction",
    description: `Triggered before Claude compacts context to manage token limits. Use this to:
    • Log context before compression
    • Save important information
    • Archive previous conversation
    • Prepare for token optimization
    • Alert about context changes
    Advanced hook for optimizing token usage.`,
  },
  SessionEnd: {
    title: "Session Ended",
    description: `Triggered when a Claude Code session ends. Use this to:
    • Final cleanup of resources
    • Archive logs and results
    • Generate final reports
    • Upload data to servers
    • Display session summary
    • Close database connections
    This is the last hook called in a session.`,
  },
};

export const NOTIFICATION_EVENT_DESCRIPTIONS: Record<string, string> = {
  on_start: "Notification when Claude task begins",
  on_stream_start: "Notification when streaming starts",
  on_completion: "Notification when task completes successfully",
  on_error: "Notification when an error occurs",
  on_cancel: "Notification when task is cancelled",
  on_timeout: "Notification when operation times out",
  on_token_limit: "Notification when token limit is reached",
};
