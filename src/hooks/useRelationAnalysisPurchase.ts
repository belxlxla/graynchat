import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { createClient } from '@supabase/supabase-js';
import { IAP } from '../types/iap';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

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

const PRODUCT_ID = 'com.grayn.app.relation_analysis';

export function useRelationAnalysisPurchase() {
  const [price, setPrice] = useState('₩2,900');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    IAP.getProductInfo({ productId: PRODUCT_ID })
      .then(info => setPrice(info.price))
      .catch(() => {});
  }, []);

  const purchase = async (userId: string, onSuccess: () => void) => {
    setIsLoading(true);
    try {
      const { receipt } = await IAP.purchase({ productId: PRODUCT_ID });

      const { data, error } = await supabase.functions.invoke('verify-iap-receipt', {
        body: { receipt, productId: PRODUCT_ID, userId }
      });

      if (error || !data?.success) {
        throw new Error(data?.error || '영수증 검증 실패');
      }

      toast.success('결제 완료! 분석을 시작합니다.');
      onSuccess();
    } catch (e: any) {
      toast.error(e.message || '결제에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return { price, isLoading, purchase };
}
