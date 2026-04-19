const STORAGE_KEY = 'rebond_onboarding'

interface OnboardingState {
  welcomed: boolean
  tourCompleted: boolean
  tourStep: number
  dismissed: boolean
}

const DEFAULT_STATE: OnboardingState = {
  welcomed: false,
  tourCompleted: false,
  tourStep: 0,
  dismissed: false,
}

function loadState(): OnboardingState {
  if (typeof localStorage === 'undefined') return { ...DEFAULT_STATE }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_STATE }
    return { ...DEFAULT_STATE, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_STATE }
  }
}

function saveState(state: OnboardingState) {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }
}

function createOnboardingStore() {
  let state = $state<OnboardingState>(loadState())

  return {
    get showWelcome() { return !state.welcomed && !state.dismissed },
    get showTour() { return state.welcomed && !state.tourCompleted && !state.dismissed },
    get tourStep() { return state.tourStep },
    get tourCompleted() { return state.tourCompleted },
    get isActive() { return !state.tourCompleted && !state.dismissed },

    completeWelcome() {
      state.welcomed = true
      saveState(state)
    },

    nextStep() {
      state.tourStep++
      saveState(state)
    },

    prevStep() {
      if (state.tourStep > 0) {
        state.tourStep--
        saveState(state)
      }
    },

    completeTour() {
      state.tourCompleted = true
      saveState(state)
    },

    dismiss() {
      state.dismissed = true
      state.tourCompleted = true
      saveState(state)
    },

    reset() {
      state = { ...DEFAULT_STATE }
      saveState(state)
    },
  }
}

export const onboarding = createOnboardingStore()
