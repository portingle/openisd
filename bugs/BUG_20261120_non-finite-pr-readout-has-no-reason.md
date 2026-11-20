# An imported passive radiator can have an unavailable resonance with no explanation

Opening [the passive-radiator project fixture](../packages/ui/test/fixtures/pr-resonance-underflow.owpr) keeps its entered moving mass and compliance. Both are finite, but their product underflows to zero. The engine calculates an infinite free-air resonance with added mass. The readout shows a dash and gives no reason.

The import should open the project and keep its entered data. The resonance should be unavailable with a reason from the engine. The import regression checks this through the app's file handler and the readout's warning button.

T943, the non-finite result guard, is blocked on the existing maximum-power contract. Two coil-wiring specs require a project to return maximum-power values for unbounded drivers. The guard removes the infinite values from the project result, so those specs fail before they can compare the wiring results.
