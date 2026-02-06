import { Clock, Mail, MapPin, Phone } from "lucide-react";

export function ContactSection() {
  return (
    <div className="space-y-5">
      <div className="pb-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Contact Us</h3>
        <p className="text-sm text-gray-500 mt-1">
          Get in touch with our support team
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Phone */}
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
              <Phone className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">Phone Support</h4>
              <p className="text-emerald-600 font-medium mt-1">
                +880 1234-567890
              </p>
              <p className="text-sm text-gray-500 mt-0.5">
                Available Mon-Sat, 9:00 AM - 6:00 PM
              </p>
            </div>
          </div>
        </div>

        {/* Email */}
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
              <Mail className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">Email Support</h4>
              <p className="text-blue-600 font-medium mt-1">
                support@bikalpo.com
              </p>
              <p className="text-sm text-gray-500 mt-0.5">
                We'll respond within 24 hours
              </p>
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center shrink-0">
              <MapPin className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">Office Address</h4>
              <p className="text-gray-700 mt-1">
                123 Business Tower, Level 5
                <br />
                Gulshan-2, Dhaka 1212
              </p>
            </div>
          </div>
        </div>

        {/* Hours */}
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
              <Clock className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">Business Hours</h4>
              <div className="text-sm text-gray-600 mt-1 space-y-1">
                <p>Saturday - Thursday: 9:00 AM - 6:00 PM</p>
                <p>Friday: Closed</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
