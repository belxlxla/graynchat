import StoreKit

@available(iOS 15.0, *)
class IAPManager: NSObject {
    static let shared = IAPManager()
    
    var onPurchaseSuccess: ((String) -> Void)?
    var onPurchaseError: ((String) -> Void)?
    
    func getProduct(productId: String) async throws -> Product {
        let products = try await Product.products(for: [productId])
        guard let product = products.first else {
            throw NSError(domain: "IAP", code: 0, userInfo: [NSLocalizedDescriptionKey: "상품을 찾을 수 없습니다."])
        }
        return product
    }
    
    func purchase(productId: String) async {
        do {
            let product = try await getProduct(productId: productId)
            let result = try await product.purchase()
            
            switch result {
            case .success(let verification):
                switch verification {
                case .verified(let transaction):
                    if let appStoreReceiptURL = Bundle.main.appStoreReceiptURL,
                       let receiptData = try? Data(contentsOf: appStoreReceiptURL) {
                        let receipt = receiptData.base64EncodedString()
                        await transaction.finish()
                        onPurchaseSuccess?(receipt)
                    }
                case .unverified:
                    onPurchaseError?("결제 검증 실패")
                }
            case .userCancelled:
                onPurchaseError?("결제가 취소되었습니다.")
            case .pending:
                onPurchaseError?("결제 승인 대기 중입니다.")
            @unknown default:
                onPurchaseError?("알 수 없는 오류")
            }
        } catch {
            onPurchaseError?(error.localizedDescription)
        }
    }
}
