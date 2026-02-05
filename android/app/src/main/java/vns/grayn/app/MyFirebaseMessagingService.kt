package vns.grayn.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class MyFirebaseMessagingService : FirebaseMessagingService() {

    // 1. 새로운 기기 토큰이 발급될 때 호출 (로그인 시 서버에 저장할 때 사용)
    override fun onNewToken(token: String) {
        super.onNewToken(token)
        // TODO: 여기서 정민님 서버 API를 호출해서 유저 ID와 이 토큰을 매칭해 저장하세요.
    }

    // 2. 푸시 메시지가 내 폰에 도착했을 때 실행됨
    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)

        // 메시지 제목과 내용 추출
        val title = remoteMessage.notification?.title ?: "새 메시지"
        val body = remoteMessage.notification?.body ?: "채팅이 도착했습니다."

        // 서버에서 보낸 추가 데이터 (채팅방 ID 등)
        val chatRoomId = remoteMessage.data["chatRoomId"]

        sendNotification(title, body, chatRoomId)
    }

    private fun sendNotification(title: String, body: String, chatRoomId: String?) {
        val channelId = "chat_channel"
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        // 알림 클릭 시 이동할 화면 (MainActivity 또는 ChatRoomActivity)
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("chatRoomId", chatRoomId) // 클릭 시 채팅방 ID 전달
        }

        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
        )

        // 알림 디자인 설정
        val notificationBuilder = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.mipmap.ic_launcher) // 앱 아이콘 설정
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true) // 클릭하면 알림 사라짐
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_HIGH)

        // Android 8.0 이상 대응 채널 생성
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(channelId, "Chat Notifications", NotificationManager.IMPORTANCE_HIGH)
            notificationManager.createNotificationChannel(channel)
        }

        notificationManager.notify(System.currentTimeMillis().toInt(), notificationBuilder.build())
    }
}