import {computed} from 'vue';
import type {ComputedRef, Ref} from 'vue';
import type {OpenISDProject} from '@openisd/design';

/** The same project assessment and count-field warning for both skins. */
export function createPrExcursionAdvice(project: ComputedRef<OpenISDProject>, changed: Ref<number>) {
  const prExcursion = computed(() => {
    void changed.value;
    return project.value.passiveRadiatorExcursionAdvice();
  });
  const prCountDq = computed(() => {
    void changed.value;
    const existing = project.value.box.passiveRadiator.countDq;
    return prExcursion.value?.warning ? [...existing, prExcursion.value.text] : existing;
  });
  return {prExcursion, prCountDq};
}
