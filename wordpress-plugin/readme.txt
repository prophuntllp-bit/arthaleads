=== Arthaleads CRM – Lead Capture for Contact Forms ===
Contributors: arthaleads
Tags: crm, lead capture, contact form, leads, real estate
Requires at least: 5.9
Tested up to: 6.7
Requires PHP: 7.4
Stable tag: 1.0.3
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Send leads from any WordPress contact form directly into Arthaleads CRM — automatically and instantly.

== Description ==

**Arthaleads CRM – Lead Capture for Contact Forms** connects your WordPress website to [Arthaleads CRM](https://arthaleads.com) so that every form submission is automatically captured as a lead, assigned to your team, and tracked in one place.

No copy-pasting. No missed leads. Every enquiry goes straight into your CRM pipeline the moment someone submits a form.

= Supported Form Plugins =

* Contact Form 7
* WPForms
* Elementor Pro Forms
* Gravity Forms
* Ninja Forms
* Forminator
* Fluent Forms

= How It Works =

1. Install and activate this plugin.
2. Copy your unique token from **Arthaleads CRM → Automation → WordPress / Website**.
3. Paste the token into the plugin settings page and save.
4. Done — every new form submission is sent to your CRM instantly.

= Features =

* Works with all major WordPress form plugins (8 supported)
* Captures name, phone, email, and message from any form
* Shows the form source (website name) as the lead source label in CRM
* Duplicate submissions within 60 seconds are automatically ignored
* Zero configuration beyond pasting your token
* Lightweight — no external libraries, no tracking scripts

= About Arthaleads CRM =

Arthaleads is a CRM platform built for real estate teams. It manages leads, follow-ups, pipelines, attendance, and performance reports in one place. Learn more at [arthaleads.com](https://arthaleads.com).

== Installation ==

1. Upload the `arthaleads-integration` folder to `/wp-content/plugins/`, or install directly from the WordPress plugin directory.
2. Activate the plugin through **Plugins → Installed Plugins** in your WordPress admin.
3. Go to **Arthaleads CRM** in the left admin menu.
4. Log in to [arthaleads.com](https://arthaleads.com), navigate to **Automation → WordPress / Website**, and copy your unique token (starts with `AW-`).
5. Paste the token into the plugin settings and click **Save**.
6. Submit a test form on your website — the lead should appear in Arthaleads CRM within seconds.

== Frequently Asked Questions ==

= Which form plugins are supported? =

Contact Form 7, WPForms, Elementor Pro Forms, Gravity Forms, Ninja Forms, Forminator, Fluent Forms, and MetForm. More plugins will be added based on demand.

= Do I need an Arthaleads account? =

Yes. You need an active [Arthaleads CRM](https://arthaleads.com) account to get your token. The plugin does nothing without a valid token.

= Will it work with multiple forms on the same site? =

Yes. Any form submission from any supported plugin on your site will be sent to Arthaleads CRM as long as the plugin is active and the token is saved.

= What data is sent to Arthaleads? =

The plugin sends: name, phone, email, message, the page URL where the form was submitted, and the form plugin name. No other data is transmitted.

= Is my data secure? =

All data is sent over HTTPS to the Arthaleads API. Your token is stored in WordPress options and never exposed publicly.

= What if a form is submitted twice in quick succession? =

The plugin automatically ignores duplicate submissions from the same phone number within 60 seconds to prevent double entries in your CRM.

= Where is the plugin settings page? =

**WordPress Admin → Arthaleads CRM** (in the left sidebar).

== Screenshots ==

1. The plugin settings page — paste your token and save.
2. Lead captured in Arthaleads CRM with source, phone, and timestamp.

== Changelog ==

= 1.0.3 =
* Restored full multi-file plugin structure with separate class files for each form integration.
* Added MetForm support (8 supported form plugins total).
* Added per-integration toggle switches in admin settings.
* Added Send Test Lead button for instant connection verification.
* Added uninstall.php to clean up options on plugin deletion.

= 1.0.1 =
* Added 60-second duplicate submission guard to prevent double leads when multiple form plugins are active simultaneously.

= 1.0.0 =
* Initial release.
* Support for Contact Form 7, WPForms, Elementor Pro Forms, Gravity Forms, Ninja Forms, Forminator, and Fluent Forms.

== Upgrade Notice ==

= 1.0.1 =
Fixes duplicate leads caused by sites running multiple form plugins at the same time. Update recommended.
