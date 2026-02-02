import UIKit
import Capacitor
import FirebaseCore
import FirebaseMessaging

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // 1. 앱 켜질 때 Firebase 시동 걸기
        FirebaseApp.configure()
        return true
    }

    // -----------------------------------------------------------------------
    // [중요] 아래 두 함수가 있어야 푸시 알림 토큰이 연결됩니다.
    // -----------------------------------------------------------------------

    // 2. 애플에게서 알림 주소(토큰)를 잘 받았을 때 -> Firebase와 Capacitor에 전달
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        // Firebase에 토큰 전달
        Messaging.messaging().apnsToken = deviceToken
        // Capacitor에 토큰 전달 (Javascript단으로 넘겨줌)
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    // 3. 알림 주소 발급에 실패했을 때 -> Capacitor에 에러 알림
    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }

    // -----------------------------------------------------------------------
    // 아래는 기존 코드들 (그대로 둠)
    // -----------------------------------------------------------------------

    func applicationWillResignActive(_ application: UIApplication) {
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
    }

    func applicationWillTerminate(_ application: UIApplication) {
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}