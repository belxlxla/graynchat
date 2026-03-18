import Capacitor
import StoreKit

@objc(IAPPlugin)
public class IAPPlugin: CAPPlugin {
    
    @objc func getProductInfo(_ call: CAPPluginCall) {
        guard let productId = call.getString("productId") else {
            call.reject("productId가 필요합니다.")
            return
        }
        
        Task {
            do {
                if #available(iOS 15.0, *) {
                    let product = try await IAPManager.shared.getProduct(productId: productId)
                    call.resolve([
                        "productId": product.id,
                        "title": product.displayName,
                        "price": product.displayPrice,
                        "priceValue": product.price.description
                    ])
                } else {
                    call.reject("iOS 15 이상 필요")
                }
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }
    
    @objc func purchase(_ call: CAPPluginCall) {
        guard let productId = call.getString("productId") else {
            call.reject("productId가 필요합니다.")
            return
        }
        
        if #available(iOS 15.0, *) {
            IAPManager.shared.onPurchaseSuccess = { receipt in
                call.resolve(["receipt": receipt])
            }
            IAPManager.shared.onPurchaseError = { error in
                call.reject(error)
            }
            Task {
                await IAPManager.shared.purchase(productId: productId)
            }
        } else {
            call.reject("iOS 15 이상 필요")
        }
    }
}
