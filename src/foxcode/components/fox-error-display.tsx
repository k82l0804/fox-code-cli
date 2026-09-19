import { createMemo, Match, Switch, type JSX } from "solid-js"
import { SplitBorder } from "@tui/ui/border"
import { useTheme } from "@tui/context/theme"
import { parseFoxErrorCode, foxErrorTitle, foxErrorDescription } from "@/foxcode/fox-errors"
import type { AssistantMessage } from "@foxcode/sdk/v2"

interface FoxErrorBlockProps {
  error: NonNullable<AssistantMessage["error"]>
  fallback: JSX.Element
}

export function FoxErrorBlock(props: FoxErrorBlockProps) {
  const { theme } = useTheme()

  const kiloErrorCode = createMemo(() => {
    return parseFoxErrorCode(props.error)
  })

  const title = createMemo(() => {
    const code = kiloErrorCode()
    return code ? foxErrorTitle(code) : undefined
  })

  const description = createMemo(() => {
    const code = kiloErrorCode()
    return code ? foxErrorDescription(code) : undefined
  })

  return (
    <Switch fallback={props.fallback}>
      <Match when={kiloErrorCode()}>
        <box
          border={["left"]}
          paddingTop={1}
          paddingBottom={1}
          paddingLeft={2}
          marginTop={1}
          backgroundColor={theme.backgroundPanel}
          customBorderChars={SplitBorder.customBorderChars}
          borderColor={theme.primary}
        >
          <text fg={theme.text}>{title()}</text>
          <text fg={theme.textMuted}>{description()}</text>
          <text fg={theme.primary}>{"Run /connect or `fox auth login` to connect"}</text>
        </box>
      </Match>
    </Switch>
  )
}
