package vns.grayn.app;

import android.Manifest;
import android.os.Build;
import android.os.Bundle; // 추가됨
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 안드로이드 13(TIRAMISU) 이상일 때만 알림 권한을 요청합니다.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 100);
        }
    }
}