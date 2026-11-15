import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const SUPABASE_URL = 'https://levdefzdiwvowtadzdkw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxldmRlZnpkaXd2b3d0YWR6ZGt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2MzA1OTcsImV4cCI6MjEwNDIwNjU5N30.9tvXNFhe6DGjAFL_igcdssn0LI0VwdQFAVldZDrS-NY';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function uploadLogo() {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'moralessedesouza@gmail.com',
    password: 'Abc12345'
  });

  if (authError) {
    console.error('Auth error:', authError.message);
    return;
  }

  console.log('Logged in as admin:', authData.user.email);

  const fileBuffer = fs.readFileSync('public/images/logo/mon-tcfca-logo.png');

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('question-images')
    .upload('brand/mon-tcfca-logo.png', fileBuffer, {
      contentType: 'image/png',
      upsert: true
    });

  if (uploadError) {
    console.error('Upload error:', uploadError.message);
    return;
  }

  const { data: publicUrlData } = supabase.storage
    .from('question-images')
    .getPublicUrl('brand/mon-tcfca-logo.png');

  console.log('Logo uploaded successfully! Public URL:', publicUrlData.publicUrl);
}

uploadLogo();
