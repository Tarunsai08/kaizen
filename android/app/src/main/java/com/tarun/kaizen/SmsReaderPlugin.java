package com.tarun.kaizen;

import android.Manifest;
import android.database.Cursor;
import android.net.Uri;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * Reads bank transaction alert SMS from the inbox (on-device only) and
 * hands over text shared into the app from other apps (Share -> Kaizen).
 */
@CapacitorPlugin(
    name = "SmsReader",
    permissions = { @Permission(alias = "sms", strings = { Manifest.permission.READ_SMS }) }
)
public class SmsReaderPlugin extends Plugin {

    static volatile String sharedText = null;
    static volatile String sharedSubject = null;

    @PluginMethod
    public void read(PluginCall call) {
        if (getPermissionState("sms") != PermissionState.GRANTED) {
            requestPermissionForAlias("sms", call, "smsPermCallback");
            return;
        }
        doRead(call);
    }

    @PermissionCallback
    private void smsPermCallback(PluginCall call) {
        if (getPermissionState("sms") == PermissionState.GRANTED) {
            doRead(call);
        } else {
            call.reject("SMS permission was not granted");
        }
    }

    private void doRead(PluginCall call) {
        long since = call.getData().optLong("since", 0L);
        int limit = call.getData().optInt("limit", 500);
        JSArray arr = new JSArray();
        Cursor c = null;
        try {
            c = getContext().getContentResolver().query(
                Uri.parse("content://sms/inbox"),
                new String[] { "_id", "address", "body", "date" },
                "date > ?",
                new String[] { String.valueOf(since) },
                "date DESC"
            );
            int n = 0;
            if (c != null) {
                while (c.moveToNext() && n < limit) {
                    JSObject o = new JSObject();
                    o.put("id", c.getString(0));
                    o.put("address", c.getString(1));
                    o.put("body", c.getString(2));
                    o.put("date", c.getLong(3));
                    arr.put(o);
                    n++;
                }
            }
            JSObject ret = new JSObject();
            ret.put("messages", arr);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Could not read SMS: " + e.getMessage());
        } finally {
            if (c != null) c.close();
        }
    }

    @PluginMethod
    public void getSharedText(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("text", sharedText);
        ret.put("subject", sharedSubject);
        sharedText = null;
        sharedSubject = null;
        call.resolve(ret);
    }
}
