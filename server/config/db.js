const mongoose = require('mongoose');

mongoose.connect('your_connection_string_here', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("MongoDB connected"))
.catch((err) => console.error("MongoDB connection error:", err));
