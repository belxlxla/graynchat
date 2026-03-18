#import <Capacitor/Capacitor.h>

CAP_PLUGIN(IAPPlugin, "IAPPlugin",
    CAP_PLUGIN_METHOD(getProductInfo, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(purchase, CAPPluginReturnPromise);
)
