import { useState, useEffect } from 'react';  // ← 이 줄 추가
import toast from 'react-hot-toast';           // ← 이 줄 추가
import { IAP } from '../../../types/iap';
import { supabase } from '../../../shared/lib/supabaseClient';
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