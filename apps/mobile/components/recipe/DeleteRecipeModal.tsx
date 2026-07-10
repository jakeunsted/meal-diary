import { useTranslation } from 'react-i18next';

import { DialogModal, DialogPanel } from '@/components/ui/DialogModal';
import { Box } from '@/components/ui/box';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';

interface DeleteRecipeModalProps {
  visible: boolean;
  isDeleting?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteRecipeModal({
  visible,
  isDeleting = false,
  onClose,
  onConfirm,
}: DeleteRecipeModalProps) {
  const { t } = useTranslation();

  const handleClose = () => {
    if (isDeleting) {
      return;
    }
    onClose();
  };

  return (
    <DialogModal visible={visible} onClose={handleClose}>
      <DialogPanel>
        <Heading size="lg" className="mb-3 text-red-400">
          {t('recipeForm.deleteRecipe')}
        </Heading>
        <Text className="mb-6 text-ice/80">{t('recipeDetail.deleteConfirm')}</Text>
        <Box className="flex-row justify-end gap-3">
          <Button variant="outline" onPress={handleClose} disabled={isDeleting}>
            <ButtonText>{t('common.cancel')}</ButtonText>
          </Button>
          <Button
            className="bg-red-500"
            onPress={onConfirm}
            disabled={isDeleting}
            testID="recipe-confirm-delete-button"
          >
            {isDeleting ? <ButtonSpinner color="#F1F5F9" /> : null}
            <ButtonText className="text-ice">{t('common.delete')}</ButtonText>
          </Button>
        </Box>
      </DialogPanel>
    </DialogModal>
  );
}
