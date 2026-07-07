import { useState } from 'react';
import { Pressable } from 'react-native';

import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';

interface FaqItem {
  q: string;
  a: string;
}

interface FaqListProps {
  faqs: readonly FaqItem[];
}

export function FaqList({ faqs }: FaqListProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const handleToggle = (index: number) => {
    setExpandedIndex((current) => (current === index ? null : index));
  };

  return (
    <Box className="gap-2">
      {faqs.map((faq, index) => {
        const isExpanded = expandedIndex === index;
        return (
          <Box key={faq.q} className="overflow-hidden rounded-xl bg-surface">
            <Pressable
              className="px-4 py-3"
              onPress={() => handleToggle(index)}
              accessibilityRole="button"
              accessibilityState={{ expanded: isExpanded }}
            >
              <Text className="text-ice font-medium">{faq.q}</Text>
            </Pressable>
            {isExpanded ? (
              <Box className="border-t border-white/10 px-4 pb-3 pt-2">
                <Text className="text-ice/80 leading-relaxed">{faq.a}</Text>
              </Box>
            ) : null}
          </Box>
        );
      })}
    </Box>
  );
}
