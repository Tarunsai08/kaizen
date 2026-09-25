package com.tarun.kaizen;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(KaizenPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        capture(intent);
        super.onNewIntent(intent);
    }

    private void capture(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        if (Intent.ACTION_SEND.equals(action) && "text/plain".equals(intent.getType())) {
            KaizenPlugin.sharedText = intent.getStringExtra(Intent.EXTRA_TEXT);
            KaizenPlugin.sharedSubject = intent.getStringExtra(Intent.EXTRA_SUBJECT);
        }
        Uri data = intent.getData();
        if (data != null && "kaizen".equals(data.getScheme())) {
            KaizenPlugin.launchAction = data.toString();
        }
    }
}
