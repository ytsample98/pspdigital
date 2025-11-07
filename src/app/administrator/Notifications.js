import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';

export const notify = (type, problemNo) => {
  let message = "";

  switch (type) {
    case "card_created":
      message =(` 🆕 Card Created! Problem #${problemNo}`);
        toast.success(`${message} `)
         
      break;

    case "card_completed":
      message =(` ✅ Card Completed! Problem #${problemNo}`);
        toast.success(`${message}`)
      break;

    default:
      break;
  }

};