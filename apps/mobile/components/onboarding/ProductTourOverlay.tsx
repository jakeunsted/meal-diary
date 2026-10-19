import { useRouter, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { useAnalyticsConsent } from '@/lib/analytics/consent';
import { useAuthStore } from '@/lib/auth/authStore';
import { hasFamilyGroup } from '@/lib/auth/helpers';
import {
  clearProductTourReplay,
  loadProductTourSeen,
  PRODUCT_TOUR_STEPS,
  resolveTourTarget,
  saveProductTourSeen,
  setProductTourVisible,
  shouldShowProductTour,
  tourStepAfterAction,
  useProductTourReplay,
  type ProductTourStepId,
} from '@/lib/onboarding/productTour';
import {
  listRegisteredTourTargetIds,
  measureTourTarget,
  requestProfileTourScroll,
  subscribeTourTargets,
  type TourTargetRect,
} from '@/lib/onboarding/tourTargets';

/** Matches app `--base` so the dim feels like the same theme, not a blue-grey cast. */
const SCRIM_COLOR = 'rgba(26, 31, 46, 0.78)';
const HOLE_RING_COLOR = 'rgba(99, 102, 241, 0.45)';
const HOLE_PAD = 10;
const HOLE_RADIUS = 12;
const MEASURE_RETRY_MS = 600;
const TAB_BAR_CONTENT_HEIGHT = 56;

function padHole(rect: TourTargetRect): TourTargetRect {
  return {
    x: Math.max(0, rect.x - HOLE_PAD),
    y: Math.max(0, rect.y - HOLE_PAD),
    width: rect.width + HOLE_PAD * 2,
    height: rect.height + HOLE_PAD * 2,
  };
}

function measureViewInWindow(view: View): Promise<TourTargetRect | null> {
  return new Promise((resolve) => {
    view.measureInWindow((x, y, width, height) => {
      if (width <= 0 || height <= 0) {
        resolve(null);
        return;
      }
      resolve({ x, y, width, height });
    });
  });
}

function toOverlayLocalRect(
  target: TourTargetRect,
  overlay: TourTargetRect | null
): TourTargetRect {
  if (!overlay) {
    return target;
  }
  return {
    x: target.x - overlay.x,
    y: target.y - overlay.y,
    width: target.width,
    height: target.height,
  };
}

function navigateToTourHref(
  router: ReturnType<typeof useRouter>,
  href: Href
): void {
  // Always navigate between tab roots. dismissTo only works when the href is
  // already in the current dismiss stack, so it leaves you on the same tab
  // when moving diary → recipes → shopping → profile.
  router.navigate(href);
}

export function ProductTourOverlay() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const router = useRouter();
  const overlayRef = useRef<View>(null);
  const user = useAuthStore((state) => state.user);
  const { loaded: consentLoaded, choice: consentChoice } = useAnalyticsConsent();
  const replayRequested = useProductTourReplay();

  const [seenLoaded, setSeenLoaded] = useState(false);
  const [seen, setSeen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [hole, setHole] = useState<TourTargetRect | null>(null);
  const [targetVersion, setTargetVersion] = useState(0);

  useEffect(() => {
    if (!user?.id) {
      setSeenLoaded(false);
      setSeen(false);
      return;
    }

    let cancelled = false;
    setSeenLoaded(false);

    void loadProductTourSeen(user.id).then((isSeen) => {
      if (!cancelled) {
        setSeen(isSeen);
        setSeenLoaded(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const visible = shouldShowProductTour({
    hasFamily: hasFamilyGroup(user),
    consentLoaded,
    consentChoice,
    seenLoaded,
    seen,
    replayRequested,
  });

  useEffect(() => {
    setProductTourVisible(visible);
    return () => {
      setProductTourVisible(false);
    };
  }, [visible]);

  useEffect(() => {
    return subscribeTourTargets(() => {
      setTargetVersion((current) => current + 1);
    });
  }, []);

  useEffect(() => {
    if (!visible) {
      return;
    }

    setStepIndex(0);
    navigateToTourHref(router, PRODUCT_TOUR_STEPS[0].href);
    // Pre-position Profile while the person is still on the diary step so the
    // invite spotlight does not have to animate-scroll when we arrive.
    void requestProfileTourScroll('invite');
  }, [visible]);

  const step = PRODUCT_TOUR_STEPS[stepIndex] ?? PRODUCT_TOUR_STEPS[0];
  const stepId = step.id;

  useEffect(() => {
    if (!visible || stepId !== 'invite') {
      return;
    }

    let cancelled = false;
    void (async () => {
      await requestProfileTourScroll('invite');
      if (!cancelled) {
        // Force one clean remeasure after the jump scroll settles.
        setTargetVersion((current) => current + 1);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, stepId]);

  useEffect(() => {
    if (!visible) {
      setHole(null);
      return;
    }

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let startTimer: ReturnType<typeof setTimeout> | null = null;

    const runMeasure = async () => {
      const availableIds = listRegisteredTourTargetIds();
      const holeId = resolveTourTarget(stepId as ProductTourStepId, availableIds);
      if (!holeId) {
        if (!cancelled) {
          setHole(null);
        }
        return;
      }

      const [rect, overlayRect] = await Promise.all([
        measureTourTarget(holeId),
        overlayRef.current ? measureViewInWindow(overlayRef.current) : Promise.resolve(null),
      ]);
      if (cancelled) {
        return;
      }

      if (rect) {
        const local = toOverlayLocalRect(rect, overlayRect);
        // Leave room for the callout at the bottom so the spotlight sits on the
        // real week / list chrome, not under the card or on the header cog.
        const bottomClearance = TAB_BAR_CONTENT_HEIGHT + Math.max(insets.bottom, 8);
        const calloutReserve = 168;
        const maxBottom = windowHeight - bottomClearance - calloutReserve;
        const top = Math.min(Math.max(0, local.y), Math.max(0, windowHeight - 8));
        const clipped: TourTargetRect = {
          x: Math.min(Math.max(0, local.x), Math.max(0, windowWidth - 8)),
          y: top,
          width: Math.min(local.width, windowWidth),
          height: Math.max(96, Math.min(local.height, maxBottom - top)),
        };
        setHole(padHole(clipped));
        return;
      }

      setHole(null);
    };

    // Brief delay after a tab change so the pre-mounted screen can paint.
    startTimer = setTimeout(() => {
      void runMeasure();
      retryTimer = setTimeout(() => {
        void runMeasure();
      }, MEASURE_RETRY_MS);
    }, stepId === 'invite' ? 80 : 30);

    return () => {
      cancelled = true;
      if (startTimer) {
        clearTimeout(startTimer);
      }
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
    };
  }, [visible, stepId, stepIndex, targetVersion, windowHeight, windowWidth, insets.bottom]);

  const handleMarkSeenAndClose = () => {
    clearProductTourReplay();
    setSeen(true);
    if (user?.id != null) {
      void saveProductTourSeen(user.id);
    }
  };

  const handleApplyAction = (action: 'next' | 'back' | 'skip' | 'done') => {
    const result = tourStepAfterAction(stepIndex, action);
    if (result.writeSeen) {
      handleMarkSeenAndClose();
    }
    if (result.nextIndex == null) {
      return;
    }
    setStepIndex(result.nextIndex);
    navigateToTourHref(router, PRODUCT_TOUR_STEPS[result.nextIndex].href);
  };

  const handleSkip = () => {
    handleApplyAction('skip');
  };

  const handleDone = () => {
    handleApplyAction('done');
  };

  const handleNext = () => {
    handleApplyAction('next');
  };

  useEffect(() => {
    if (!visible) {
      return;
    }

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      const result = tourStepAfterAction(stepIndex, 'back');
      if (result.writeSeen) {
        clearProductTourReplay();
        setSeen(true);
        if (user?.id != null) {
          void saveProductTourSeen(user.id);
        }
      }
      if (result.nextIndex != null) {
        setStepIndex(result.nextIndex);
        navigateToTourHref(router, PRODUCT_TOUR_STEPS[result.nextIndex].href);
      }
      return true;
    });

    return () => {
      subscription.remove();
    };
  }, [visible, stepIndex, router, user?.id]);

  if (!visible) {
    return null;
  }

  const totalSteps = PRODUCT_TOUR_STEPS.length;
  const isLastStep = stepIndex === totalSteps - 1;
  const currentStepNumber = stepIndex + 1;
  const tabBarClearance = TAB_BAR_CONTENT_HEIGHT + Math.max(insets.bottom, 8);
  const holeIsLarge = hole != null && hole.height > windowHeight * 0.5;

  const calloutPreferredBelow =
    hole != null && hole.y + hole.height + 180 < windowHeight - tabBarClearance;
  const placeCalloutBelow = !holeIsLarge && calloutPreferredBelow;
  const placeCalloutAbove =
    !holeIsLarge && !placeCalloutBelow && hole != null && hole.y > 160;

  let calloutStyle: {
    top?: number;
    bottom?: number;
    left: number;
    right: number;
  } = {
    left: 16,
    right: 16,
    bottom: tabBarClearance + 12,
  };

  if (placeCalloutBelow && hole) {
    calloutStyle = {
      left: 16,
      right: 16,
      top: hole.y + hole.height + 12,
    };
  } else if (placeCalloutAbove && hole) {
    calloutStyle = {
      left: 16,
      right: 16,
      bottom: windowHeight - hole.y + 12,
    };
  }

  const holeLeft = hole?.x ?? 0;
  const holeTop = hole?.y ?? 0;
  const holeRight = hole ? hole.x + hole.width : 0;
  const holeBottom = hole ? hole.y + hole.height : 0;

  return (
    <View
      ref={overlayRef}
      pointerEvents="box-none"
      style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 50 }}
      testID="product-tour-overlay"
    >
      {/* Full-screen touch catcher — cutout is visual only, no pass-through */}
      <View
        pointerEvents="auto"
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
      />

      {hole ? (
        <>
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: holeTop,
              backgroundColor: SCRIM_COLOR,
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: holeBottom,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: SCRIM_COLOR,
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: holeTop,
              left: 0,
              width: holeLeft,
              height: hole.height,
              backgroundColor: SCRIM_COLOR,
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: holeTop,
              left: holeRight,
              right: 0,
              height: hole.height,
              backgroundColor: SCRIM_COLOR,
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: holeTop,
              left: holeLeft,
              width: hole.width,
              height: hole.height,
              borderRadius: HOLE_RADIUS,
              borderWidth: 1.5,
              borderColor: HOLE_RING_COLOR,
            }}
          />
        </>
      ) : (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: SCRIM_COLOR,
          }}
        />
      )}

      <Box
        className="absolute rounded-2xl border border-ice/15 bg-surface p-4"
        style={calloutStyle}
        testID="product-tour-callout"
        pointerEvents="auto"
      >
        <Text className="mb-2 text-sm text-ice/55">
          {t('productTour.progress', {
            current: currentStepNumber,
            total: totalSteps,
          })}
        </Text>
        <Heading size="md" className="mb-2 text-ice">
          {t(step.titleKey)}
        </Heading>
        <Text className="mb-4 text-sm leading-relaxed text-ice/75">{t(step.bodyKey)}</Text>

        <Box className="flex-row gap-3">
          <Button
            variant="outline"
            className="flex-1 border-ice/25"
            onPress={handleSkip}
            testID="product-tour-skip"
          >
            <ButtonText className="text-ice/90">{t('productTour.skip')}</ButtonText>
          </Button>
          {isLastStep ? (
            <Button className="flex-1 bg-primary" onPress={handleDone} testID="product-tour-done">
              <ButtonText className="text-ice">{t('productTour.done')}</ButtonText>
            </Button>
          ) : (
            <Button className="flex-1 bg-primary" onPress={handleNext} testID="product-tour-next">
              <ButtonText className="text-ice">{t('productTour.next')}</ButtonText>
            </Button>
          )}
        </Box>
      </Box>
    </View>
  );
}
