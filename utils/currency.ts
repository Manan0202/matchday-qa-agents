// Matches MatchDay's UI money formatting (e.g. "$120.00", "$162.00") so
// tests can build expected strings instead of hand-writing them per spec.
export function formatUsd(amount: number): string {
    return `$${amount.toFixed(2)}`
}
