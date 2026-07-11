import { Box } from '@/components/ui/box';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';

export interface LegalSection {
  title: string;
  body: readonly string[];
}

interface LegalSectionListProps {
  sections: readonly LegalSection[];
}

export function LegalSectionList({ sections }: LegalSectionListProps) {
  return (
    <>
      {sections.map((section) => (
        <Box key={section.title} className="mb-6">
          <Heading size="md" className="text-ice mb-2">
            {section.title}
          </Heading>
          {section.body.map((paragraph) => (
            <Text key={paragraph} className="text-ice/80 mb-2 leading-relaxed">
              {paragraph}
            </Text>
          ))}
        </Box>
      ))}
    </>
  );
}
