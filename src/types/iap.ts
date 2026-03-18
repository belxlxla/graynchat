import { registerPlugin } from '@capacitor/core';

export interface IAPPlugin {
  getProductInfo(options: { productId: string }): Promise<{
    productId: string;
    title: string;
    price: string;
    priceValue: string;
  }>;
  purchase(options: { productId: string }): Promise<{
    receipt: string;
  }>;
}

export const IAP = registerPlugin<IAPPlugin>('IAPPlugin');