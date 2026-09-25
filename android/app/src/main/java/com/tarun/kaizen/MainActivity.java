package com.tarun.kaizen;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SmsReaderPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        captureShare(intent);
        super.onNewIntent(intent);
    }

    private void captureShare(Intent intent) {
        if (intent == null) return;
        if (Intent.ACTION_SEND.equals(intent.getAction()) && "text/plain".equals(intent.getType())) {
            SmsReaderPlugin.sharedText = intent.getStringExtra(Intent.EXTRA_TEXT);
            SmsReaderPlugin.sharedSubject = intent.getStringExtra(Intent.EXTRA_SUBJECT);
        }
    }
}
