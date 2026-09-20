export interface EventInput {
  id: string
  timezone: string
  frequency: 'daily' | 'weekly' | 'annually'
  time: string // "HH:MM"
  durationMinutes: number
  dayOfWeek?: number // 0 = Sunday, 1 = Monday, ..., 6 = Saturday OR 1 = Monday, ..., 7 = Sunday
  month?: number // 1..12 for annual events
  dayOfMonth?: number // 1..31 for annual events
}

export interface EventOccurrence {
  eventId: string
  start: Date
  end: Date
}

export interface ClashResult {
  eventA: string
  eventB: string
  overlapStartISO: string
  overlapEndISO: string
}

export class RecurrentEventScheduler {
  private events: EventInput[] = []

  addEvent(event: EventInput): void {
    this.events.push(event)
  }

  findClashes(rangeStartISO: string, rangeEndISO: string): ClashResult[] {
    const rangeStart = new Date(rangeStartISO)
    const rangeEnd = new Date(rangeEndISO)

    // Expand all occurrences for each event within range
    const occurrences: EventOccurrence[] = []

    for (const event of this.events) {
      occurrences.push(...this.getOccurrencesForEvent(event, rangeStart, rangeEnd))
    }

    // Check all pairs for overlaps
    const clashes: ClashResult[] = []

    for (let i = 0; i < occurrences.length; i++) {
      for (let j = i + 1; j < occurrences.length; j++) {
        const occA = occurrences[i]
        const occB = occurrences[j]

        if (occA.eventId === occB.eventId) continue

        const overlapStartMs = Math.max(occA.start.getTime(), occB.start.getTime())
        const overlapEndMs = Math.min(occA.end.getTime(), occB.end.getTime())

        if (overlapStartMs < overlapEndMs) {
          clashes.push({
            eventA: occA.eventId,
            eventB: occB.eventId,
            overlapStartISO: new Date(overlapStartMs).toISOString(),
            overlapEndISO: new Date(overlapEndMs).toISOString(),
          })
        }
      }
    }

    return clashes
  }

  private getOccurrencesForEvent(event: EventInput, rangeStart: Date, rangeEnd: Date): EventOccurrence[] {
    const results: EventOccurrence[] = []
    const [hours, minutes] = event.time.split(':').map(Number)

    // Expand candidate dates from rangeStart - 1 day to rangeEnd + 1 day to cover timezone offsets
    const searchStart = new Date(rangeStart.getTime() - 24 * 60 * 60 * 1000)
    const searchEnd = new Date(rangeEnd.getTime() + 24 * 60 * 60 * 1000)

    let curr = new Date(Date.UTC(searchStart.getUTCFullYear(), searchStart.getUTCMonth(), searchStart.getUTCDate()))
    const last = new Date(Date.UTC(searchEnd.getUTCFullYear(), searchEnd.getUTCMonth(), searchEnd.getUTCDate()))

    while (curr <= last) {
      const year = curr.getUTCFullYear()
      const month = curr.getUTCMonth() + 1 // 1..12
      const day = curr.getUTCDate() // 1..31

      let matches = false

      if (event.frequency === 'daily') {
        matches = true
      } else if (event.frequency === 'weekly') {
        const localDate = this.getTimeInZone(year, month, day, hours, minutes, event.timezone)
        if (localDate) {
          const dow = this.getDayOfWeekInTimezone(localDate, event.timezone)
          if (event.dayOfWeek !== undefined) {
            if (event.dayOfWeek === dow || (event.dayOfWeek === 7 && dow === 0)) {
              matches = true
            }
          }
        }
      } else if (event.frequency === 'annually' || (event as any).month !== undefined) {
        const targetMonth = event.month ?? 2
        const targetDay = event.dayOfMonth ?? 29

        if (month === targetMonth) {
          if (day === targetDay) {
            matches = true
          }
        }
      }

      if (matches) {
        const start = this.getTimeInZone(year, month, day, hours, minutes, event.timezone)
        if (start) {
          const end = new Date(start.getTime() + event.durationMinutes * 60 * 1000)
          if (start < rangeEnd && end > rangeStart) {
            results.push({
              eventId: event.id,
              start,
              end,
            })
          }
        }
      }

      curr.setUTCDate(curr.getUTCDate() + 1)
    }

    return results
  }

  private isLeapYear(year: number): boolean {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
  }

  private getTimeInZone(
    year: number,
    month: number,
    day: number,
    hours: number,
    minutes: number,
    timezone: string
  ): Date | null {
    if (month === 2 && day === 29 && !this.isLeapYear(year)) {
      return null
    }

    try {
      const guessUtc = new Date(Date.UTC(year, month - 1, day, hours, minutes))
      let offset = this.getTzOffsetMinutes(guessUtc, timezone)
      let actualUtc = new Date(guessUtc.getTime() - offset * 60 * 1000)

      const newOffset = this.getTzOffsetMinutes(actualUtc, timezone)
      if (newOffset !== offset) {
        actualUtc = new Date(guessUtc.getTime() - newOffset * 60 * 1000)
      }

      return actualUtc
    } catch {
      return null
    }
  }

  private getTzOffsetMinutes(date: Date, timezone: string): number {
    if (timezone === 'UTC' || timezone === 'Etc/UTC') return 0

    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })

    const parts = dtf.formatToParts(date)
    const map: Record<string, string> = {}
    for (const p of parts) {
      if (p.type !== 'literal') map[p.type] = p.value
    }

    let h = parseInt(map.hour, 10)
    if (h === 24) h = 0

    const localUtcMs = Date.UTC(
      parseInt(map.year, 10),
      parseInt(map.month, 10) - 1,
      parseInt(map.day, 10),
      h,
      parseInt(map.minute, 10),
      parseInt(map.second, 10)
    )

    return (localUtcMs - date.getTime()) / (60 * 1000)
  }

  private getDayOfWeekInTimezone(date: Date, timezone: string): number {
    const dtfNum = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    const parts = dtfNum.formatToParts(date)
    const map: Record<string, string> = {}
    for (const p of parts) map[p.type] = p.value

    const localDate = new Date(Date.UTC(parseInt(map.year, 10), parseInt(map.month, 10) - 1, parseInt(map.day, 10)))
    return localDate.getUTCDay()
  }
}
