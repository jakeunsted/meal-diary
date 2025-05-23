<template>
  <div class="flex flex-col items-center gap-4">
    <div class="avatar mb-4">
      <div class="mask mask-squircle w-32 h-32 ring ring-primary ring-offset-base-100 ring-offset-2">
        <img :src="avatarUrl" class="w-full h-full object-cover" />
      </div>
    </div>
    
    <div class="flex flex-col gap-4 w-full max-w-md">
      <div class="form-control">
        <label class="label">
          <span class="label-text">Skin Tone</span>
        </label>
        <select v-model="avatarOptions.skinColor" class="select select-bordered w-full">
          <option value="Tanned">Tanned</option>
          <option value="Yellow">Yellow</option>
          <option value="Pale">Pale</option>
          <option value="Light">Light</option>
          <option value="Brown">Brown</option>
          <option value="DarkBrown">Dark Brown</option>
          <option value="Black">Black</option>
        </select>
      </div>

      <div class="form-control">
        <label class="label">
          <span class="label-text">Hair Style</span>
        </label>
        <select v-model="avatarOptions.topType" class="select select-bordered w-full">
          <option value="NoHair">No Hair</option>
          <option value="Hat">Hat</option>
          <option value="Hijab">Hijab</option>
          <option value="Turban">Turban</option>
          <option value="WinterHat1">Winter Hat</option>
          <option value="WinterHat2">Winter Hat 2</option>
          <option value="WinterHat3">Winter Hat 3</option>
          <option value="WinterHat4">Winter Hat 4</option>
          <option value="LongHairBigHair">Long Hair</option>
          <option value="LongHairBob">Bob</option>
          <option value="LongHairCurly">Curly</option>
          <option value="LongHairCurvy">Curvy</option>
          <option value="LongHairDreads">Dreads</option>
          <option value="LongHairFrida">Frida</option>
          <option value="LongHairFro">Fro</option>
          <option value="LongHairFroBand">Fro Band</option>
          <option value="LongHairNotTooLong">Not Too Long</option>
          <option value="LongHairShavedSides">Shaved Sides</option>
          <option value="LongHairMiaWallace">Mia Wallace</option>
          <option value="LongHairStraight">Straight</option>
          <option value="LongHairStraight2">Straight 2</option>
          <option value="LongHairStraightStrand">Straight Strand</option>
          <option value="ShortHairDreads01">Short Dreads</option>
          <option value="ShortHairDreads02">Short Dreads 2</option>
          <option value="ShortHairFrizzle">Frizzle</option>
          <option value="ShortHairShaggyMullet">Shaggy Mullet</option>
          <option value="ShortHairShortCurly">Short Curly</option>
          <option value="ShortHairShortFlat">Short Flat</option>
          <option value="ShortHairShortRound">Short Round</option>
          <option value="ShortHairShortWaved">Short Waved</option>
          <option value="ShortHairSides">Sides</option>
          <option value="ShortHairTheCaesar">The Caesar</option>
          <option value="ShortHairTheCaesarSidePart">The Caesar Side Part</option>
        </select>
      </div>

      <div class="form-control">
        <label class="label">
          <span class="label-text">Hair Color</span>
        </label>
        <select v-model="avatarOptions.hairColor" class="select select-bordered w-full">
          <option value="Auburn">Auburn</option>
          <option value="Black">Black</option>
          <option value="Blonde">Blonde</option>
          <option value="BlondeGolden">Golden Blonde</option>
          <option value="Brown">Brown</option>
          <option value="BrownDark">Dark Brown</option>
          <option value="PastelPink">Pastel Pink</option>
          <option value="Platinum">Platinum</option>
          <option value="Red">Red</option>
          <option value="SilverGray">Silver Gray</option>
        </select>
      </div>

      <div class="form-control">
        <label class="label">
          <span class="label-text">Accessories</span>
        </label>
        <select v-model="avatarOptions.accessoriesType" class="select select-bordered w-full">
          <option value="Blank">None</option>
          <option value="Kurt">Kurt</option>
          <option value="Prescription01">Prescription 1</option>
          <option value="Prescription02">Prescription 2</option>
          <option value="Round">Round</option>
          <option value="Sunglasses">Sunglasses</option>
          <option value="Wayfarers">Wayfarers</option>
        </select>
      </div>

      <div class="flex gap-2">
        <button class="btn btn-primary flex-1" @click="saveAvatar">Save Avatar</button>
        <button class="btn flex-1" @click="$emit('close')">Cancel</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useUserStore } from '~/stores/user';

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const userStore = useUserStore();

const avatarOptions = ref({
  skinColor: 'Light',
  topType: 'ShortHairShortFlat',
  hairColor: 'Brown',
  accessoriesType: 'Blank',
});

const avatarUrl = computed(() => {
  const baseUrl = 'https://avataaars.io/?';
  const params = new URLSearchParams({
    skinColor: avatarOptions.value.skinColor,
    topType: avatarOptions.value.topType,
    hairColor: avatarOptions.value.hairColor,
    accessoriesType: avatarOptions.value.accessoriesType,
  });
  return baseUrl + params.toString();
});

const saveAvatar = async () => {
  try {
    await userStore.updateUserAvatar(avatarUrl.value);
    emit('close');
  } catch (error) {
    console.error('Error saving avatar:', error);
  }
};
</script> 