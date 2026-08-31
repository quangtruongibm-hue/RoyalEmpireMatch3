# Royal Empire Match 3 - Admin Players + FCM v3

Bộ này giữ giao diện Admin hiện tại và bổ sung:

- Dữ liệu người chơi từ Firestore `players`
- Lọc Player UID, Level, Ads, ngày đăng nhập, mua hàng
- Xuất Excel
- Gửi FCM theo nhóm
- Gửi thử 1 thiết bị
- Xem số người chơi phù hợp / có token / không có token
- Lưu lịch sử chiến dịch vào `fcm_campaigns`

## 1. Website

Thay 3 file ở website bằng:

- `index.html`
- `script.js`
- `style.css`

Website hiện gọi Firebase Cloud Functions tại:
`https://us-central1-royal-empire-match-3.cloudfunctions.net/`

Sau khi upload GitHub Pages, nhấn `Ctrl + F5`.

## 2. Firebase Functions

Cấu trúc:

```text
functions/
  index.js
  package.json
  .env
  .env.example
```

Mở `.env` và thay:

```text
ADMIN_EMAILS=YOUR_ADMIN_EMAIL@example.com
```

thành đúng email tài khoản Admin đang đăng nhập Firebase Authentication. Có thể nhập nhiều email, ngăn cách bằng dấu phẩy.

Không đưa service-account JSON hoặc Server Key vào website/GitHub.

## 3. Deploy

Mở CMD/PowerShell tại thư mục chứa `firebase.json`, rồi chạy:

```bash
cd functions
npm install
cd ..
firebase use royal-empire-match-3
firebase deploy --only functions
```

Sau khi deploy thành công phải thấy 3 function:

- `getAdminPlayers`
- `sendFcmNotification`
- `getFcmHistory`

## 4. Firestore Rules

Các function dùng Firebase Admin SDK nên việc đọc `players` và gửi FCM không cần mở public Firestore rules. Giữ rules hiện tại của bạn.

Website vẫn có các thao tác trực tiếp với `games` và `siteContent`, vì vậy không tự ý thay rules hiện tại nếu chưa kiểm tra toàn bộ website.

## 5. Dữ liệu FCM cần có trong players

Mỗi player cần có trường:

```text
fcm_token
```

FCMManager trong Unity phải lưu token vào:

```text
players/{playerUID}/fcm_token
```

Các trường khác mà Admin đang đọc gồm:

```text
current_level / unlock_level / level
gold / GoldIten
time / TimeIten
move / MoveIten
bomb / BombIten
total_watch_ads / reward_ad_count / TotalWatchAds
total_buy_gold_1000 / TotalBuygold1000
total_buy_gold_5000 / TotalBuygold5000
no_ads / NoAdsIten
last_login / lastLogin
last_login_date / LastLoginDate
```

## 6. Logic nhóm FCM

- Tất cả người chơi
- Chưa đăng nhập hôm nay
- Đã 2 ngày chưa đăng nhập
- Level < 50
- Level < 100
- Ads < 10
- Chưa từng mua Gold/Remove Ads

Khi chọn nhiều điều kiện, hệ thống dùng AND.

## 7. Lỗi đã sửa trong v3

`functions/index.js` bản trước có lỗi hàm `json()` sử dụng biến `req` ngoài phạm vi. Bản v3 đã sửa thành `json(req, res, status, body)`.

## 8. Kiểm tra sau deploy

1. Đăng nhập Admin trên website.
2. Mở `👤 Dữ liệu người chơi`.
3. Bấm `Tải dữ liệu người chơi`.
4. Mở `🔔 Gửi thông báo FCM`.
5. Bấm `Tính lại đối tượng`.
6. Kiểm tra số `Có FCM Token`.
7. Nhập tiêu đề + nội dung.
8. Bấm `🧪 Gửi thử` trước.
9. Nếu điện thoại nhận được, mới bấm `🚀 Gửi thông báo`.
