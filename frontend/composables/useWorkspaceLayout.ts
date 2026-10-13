export type WorkspaceView = 'diary' | 'recipes' | 'shopping-list';

export interface WorkspaceLayoutState {
  boardDiaryFraction: number;
  boardRecipesFraction: number;
  splitFraction: number;
  splitViews: [WorkspaceView, WorkspaceView];
}

const STORAGE_KEY = 'meal-diary-workspace';
const MIN_FRACTION = 0.22;
const MAX_FRACTION = 0.78;

const VIEWS: WorkspaceView[] = ['diary', 'recipes', 'shopping-list'];

const defaultState = (): WorkspaceLayoutState => ({
  boardDiaryFraction: 0.5,
  boardRecipesFraction: 0.5,
  splitFraction: 0.5,
  splitViews: ['diary', 'shopping-list'],
});

const clampFraction = (value: number) => {
  if (!Number.isFinite(value)) {
    return 0.5;
  }
  return Math.min(MAX_FRACTION, Math.max(MIN_FRACTION, value));
};

const isWorkspaceView = (value: unknown): value is WorkspaceView => {
  return typeof value === 'string' && VIEWS.includes(value as WorkspaceView);
};

const sanitizeViews = (value: unknown): [WorkspaceView, WorkspaceView] => {
  if (!Array.isArray(value) || value.length !== 2) {
    return ['diary', 'shopping-list'];
  }

  const first: WorkspaceView = isWorkspaceView(value[0]) ? value[0] : 'diary';
  let second: WorkspaceView = isWorkspaceView(value[1]) ? value[1] : 'shopping-list';
  if (second === first) {
    second = first === 'shopping-list' ? 'recipes' : 'shopping-list';
  }
  return [first, second];
};

let hasLoadedLayout = false;

export const useWorkspaceLayout = () => {
  const state = useState<WorkspaceLayoutState>('workspace-layout', defaultState);

  const persist = () => {
    if (!import.meta.client) {
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.value));
  };

  const load = () => {
    if (!import.meta.client || hasLoadedLayout) {
      return;
    }
    hasLoadedLayout = true;

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as Partial<WorkspaceLayoutState>;
      state.value = {
        boardDiaryFraction: clampFraction(parsed.boardDiaryFraction ?? 0.5),
        boardRecipesFraction: clampFraction(parsed.boardRecipesFraction ?? 0.5),
        splitFraction: clampFraction(parsed.splitFraction ?? 0.5),
        splitViews: sanitizeViews(parsed.splitViews),
      };
    } catch (error) {
      console.warn('Failed to load workspace layout:', error);
    }
  };

  const setBoardDiaryFraction = (value: number) => {
    state.value = {
      ...state.value,
      boardDiaryFraction: clampFraction(value),
    };
  };

  const setBoardRecipesFraction = (value: number) => {
    state.value = {
      ...state.value,
      boardRecipesFraction: clampFraction(value),
    };
  };

  const setSplitFraction = (value: number) => {
    state.value = {
      ...state.value,
      splitFraction: clampFraction(value),
    };
  };

  const setSplitView = (index: 0 | 1, view: WorkspaceView) => {
    const views: [WorkspaceView, WorkspaceView] = [...state.value.splitViews];
    const otherIndex = index === 0 ? 1 : 0;
    if (views[otherIndex] === view) {
      views[otherIndex] = views[index];
    }
    views[index] = view;
    state.value = {
      ...state.value,
      splitViews: views,
    };
    persist();
  };

  onMounted(() => {
    load();
  });

  return {
    state,
    persist,
    setBoardDiaryFraction,
    setBoardRecipesFraction,
    setSplitFraction,
    setSplitView,
  };
};
