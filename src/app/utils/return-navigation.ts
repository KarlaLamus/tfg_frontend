export interface ReturnNavigationState {
  returnTo?: string;
  returnLabel?: string;
  focusSection?: string;
}

export const buildReturnNavigationState = (
  returnTo: string,
  returnLabel: string,
  extraState?: Omit<ReturnNavigationState, 'returnTo' | 'returnLabel'>
): ReturnNavigationState => ({
  returnTo,
  returnLabel,
  ...extraState,
});

export const getSafeReturnNavigation = (
  state: ReturnNavigationState | null | undefined,
  fallbackTo: string,
  fallbackLabel: string
) => ({
  destination:
    state?.returnTo && state.returnTo.startsWith('/') ? state.returnTo : fallbackTo,
  label: state?.returnLabel ?? fallbackLabel,
});
