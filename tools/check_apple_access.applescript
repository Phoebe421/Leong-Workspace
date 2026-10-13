-- READ ONLY: count calendar containers and reminder lists.
-- Running this on macOS may show system Automation permission prompts.
-- Never creates, edits, deletes, completes or imports anything.
set report to "macOS: " & (do shell script "/usr/bin/sw_vers -productVersion")
try
    tell application "Calendar"
        set calendarCount to count of calendars
    end tell
    set report to report & linefeed & "Calendar: readable; calendar containers: " & calendarCount
on error errMsg number errCode
    set report to report & linefeed & "Calendar: read check failed; error " & errCode & ": " & errMsg
end try
try
    tell application "Reminders"
        set listCount to count of lists
    end tell
    set report to report & linefeed & "Reminders: readable; reminder lists: " & listCount
on error errMsg number errCode
    set report to report & linefeed & "Reminders: read check failed; error " & errCode & ": " & errMsg
end try
return report
