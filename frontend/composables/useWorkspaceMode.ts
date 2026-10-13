export type WorkspaceMode = 'single' | 'split' | 'board';

export const WORKSPACE_ROUTES = ['/diary', '/recipes', '/shopping-list'] as const;

const TABLET_QUERY = '(min-width: 768px)';
const BOARD_QUERY = '(min-width: 1280px)';

let stopListening: (() => void) | null = null;

export const useWorkspaceMode = () => {
  const route = useRoute();
  const isTabletUp = useState('workspace-is-tablet', () => false);
  const isBoard = useState('workspace-is-board', () => false);

  const mode = computed<WorkspaceMode>(() => {
    if (!isTabletUp.value) {
      return 'single';
    }
    if (isBoard.value) {
      return 'board';
    }
    return 'split';
  });

  const isWorkspaceRoute = computed(() => {
    return WORKSPACE_ROUTES.some((path) => route.path === path);
  });

  const showWorkspace = computed(() => mode.value !== 'single' && isWorkspaceRoute.value);

  const ensureListening = () => {
    if (!import.meta.client || stopListening) {
      return;
    }

    const tabletQuery = window.matchMedia(TABLET_QUERY);
    const boardQuery = window.matchMedia(BOARD_QUERY);
    const sync = () => {
      isTabletUp.value = tabletQuery.matches;
      isBoard.value = boardQuery.matches;
    };

    sync();
    tabletQuery.addEventListener('change', sync);
    boardQuery.addEventListener('change', sync);
    stopListening = () => {
      tabletQuery.removeEventListener('change', sync);
      boardQuery.removeEventListener('change', sync);
      stopListening = null;
    };
  };

  onMounted(() => {
    ensureListening();
  });

  return {
    isTabletUp,
    isBoard,
    mode,
    isWorkspaceRoute,
    showWorkspace,
  };
};
