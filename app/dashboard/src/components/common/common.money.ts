/**
 * S-7.12 Money formatting (spec 09 § S-7.12, spec 11 § Localization &
 * Formatting). "Money renders via Intl.NumberFormat in the workspace
 * currency with the code always visible — ETB 1,240.00."
 */

export function formatMoney(
  amount: number,
  currency: string = 'ETB',
  locale: string = 'en-US',
): string {
  const formatted = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency.toUpperCase(),
    currencyDisplay: 'code',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
  // Intl with currencyDisplay: 'code' produces "ETB 1,240.00" on most
  // locales; the code is always visible, never just a symbol.
  return formatted
}

export function formatMoneyWithUsd(
  amount: number,
  currency: string = 'ETB',
  usdAmount?: number,
  locale: string = 'en-US',
): string {
  const primary = formatMoney(amount, currency, locale)
  if (usdAmount !== undefined && currency !== 'USD') {
    const usd = formatMoney(usdAmount, 'USD', locale)
    return `${primary} (${usd})`
  }
  return primary
}

export function isCurrencyCodeValid(code: string): boolean {
  return /^[A-Z]{3}$/.test(code.toUpperCase())
}
