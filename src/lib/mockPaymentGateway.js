export const mockPaymentGateway = Object.freeze({
  async charge({ decline = false } = {}) {
    return decline ? { success: false } : { success: true };
  },
});
