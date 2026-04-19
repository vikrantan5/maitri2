import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../config/firebaseConfig';
import { getUserDetails } from '../../services/userService';
import { LinearGradient } from 'expo-linear-gradient';
import { ShieldCheck, Mail, Lock, ArrowLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AdminLoginScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};
    if (!email.trim()) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = 'Email is invalid';
    if (!password) newErrors.password = 'Password is required';
    else if (password.length < 6) newErrors.password = 'Password must be at least 6 characters';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAdminLogin = async () => {
    if (!validateForm()) return;
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      const userDetails = await getUserDetails(user.uid);

      if (!userDetails) {
        Alert.alert(
          'Access Denied',
          'This account does not have a completed profile.'
        );
        await auth.signOut();
        return;
      }

      if (userDetails.isAdmin !== true) {
        Alert.alert(
          'Access Denied',
          'This account does not have admin privileges. Please use the regular login.'
        );
        await auth.signOut();
        return;
      }

      // Valid admin - go to dashboard
      router.replace('/admin-dashboard');
    } catch (error) {
      console.error('Admin login error:', error);
      let errorMessage = 'An error occurred during admin login';
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
        errorMessage = 'Invalid email or password';
      } else if (error.code === 'auth/user-not-found') {
        errorMessage = 'No admin account found with this email';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed attempts. Please try again later';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your internet connection';
      }
      Alert.alert('Admin Login Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <LinearGradient colors={['#0F0C29', '#302B63', '#24243E']} style={styles.gradient}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 20 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.replace('/(auth)/login')}
            data-testid="admin-login-back-btn"
          >
            <ArrowLeft size={22} color="#FFFFFF" strokeWidth={2} />
            <Text style={styles.backText}>Back to User Login</Text>
          </TouchableOpacity>

          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <ShieldCheck size={60} color="#FFD700" strokeWidth={2} />
            </View>
            <Text style={styles.title}>Admin Portal</Text>
            <Text style={styles.subtitle}>Maitri Administrator Access</Text>
          </View>

          <View style={styles.formContainer}>
            <Text style={styles.formTitle}>Admin Sign In</Text>
            <Text style={styles.formSubtitle}>Restricted - authorized personnel only</Text>

            <View style={styles.inputContainer}>
              <View style={styles.inputIconContainer}>
                <Mail size={20} color="#FFD700" strokeWidth={2} />
              </View>
              <TextInput
                style={styles.input}
                placeholder="Admin Email"
                placeholderTextColor="#999"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                data-testid="admin-email-input"
              />
            </View>
            {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}

            <View style={styles.inputContainer}>
              <View style={styles.inputIconContainer}>
                <Lock size={20} color="#FFD700" strokeWidth={2} />
              </View>
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#999"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                data-testid="admin-password-input"
              />
            </View>
            {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}

            <TouchableOpacity
              style={styles.loginButton}
              onPress={handleAdminLogin}
              disabled={loading}
              data-testid="admin-login-button"
            >
              {loading ? (
                <ActivityIndicator color="#000000" />
              ) : (
                <Text style={styles.loginButtonText}>Sign In as Admin</Text>
              )}
            </TouchableOpacity>

            <Text style={styles.noticeText}>
              Only accounts flagged with admin privileges can sign in here.
            </Text>
          </View>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24 },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  header: { alignItems: 'center', marginBottom: 36, marginTop: 8 },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 215, 0, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 3,
    borderColor: 'rgba(255, 215, 0, 0.35)',
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFD700',
    marginBottom: 6,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  formContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  formTitle: { fontSize: 22, fontWeight: '700', color: '#333', marginBottom: 6 },
  formSubtitle: { fontSize: 13, color: '#777', marginBottom: 22 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    marginBottom: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  inputIconContainer: { marginRight: 12 },
  input: { flex: 1, paddingVertical: 16, fontSize: 16, color: '#333' },
  errorText: { color: '#DC143C', fontSize: 12, marginBottom: 12, marginLeft: 4 },
  loginButton: {
    backgroundColor: '#FFD700',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  loginButtonText: {
    color: '#000000',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  noticeText: {
    marginTop: 18,
    color: '#888',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});
