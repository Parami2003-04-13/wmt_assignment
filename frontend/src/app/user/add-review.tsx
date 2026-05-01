import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import StarRating from '../../components/StarRating';
import api from '../../services/api';

const CreateReviewScreen = () => {
  const router = useRouter();
  const { mealId } = useLocalSearchParams<{ mealId: string }>();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert('Required', 'Please select a star rating.');
      return;
    }

    if (!comment.trim()) {
      Alert.alert('Required', 'Please write a comment.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/reviews', {
        meal: mealId,
        rating,
        comment: comment.trim(),
      });

      Alert.alert('Success', 'Thank you for your review!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: any) {
      console.error('Review submission error:', error);
      const errorMessage = error.response?.data?.message || 'Failed to submit review. Please try again.';
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Rate your Meal</Text>
        <Text style={styles.subtitle}>How was your experience?</Text>

        <View style={styles.ratingSection}>
          <StarRating rating={rating} onRatingChange={setRating} />
          <Text style={styles.ratingText}>
            {rating > 0 ? `${rating} / 5 Stars` : 'Select a rating'}
          </Text>
        </View>

        <View style={styles.inputSection}>
          <Text style={styles.label}>Your Review</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Tell others what you thought about this meal..."
            placeholderTextColor="#95a5a6"
            multiline
            numberOfLines={5}
            value={comment}
            onChangeText={setComment}
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity
          style={[styles.submitButton, loading && styles.disabledButton]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Submit Review</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    padding: 20,
    flexGrow: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 5,
    textAlign: 'center',
    marginTop: 20,
  },
  subtitle: {
    fontSize: 16,
    color: '#7f8c8d',
    marginBottom: 30,
    textAlign: 'center',
  },
  ratingSection: {
    alignItems: 'center',
    marginBottom: 30,
    backgroundColor: '#f8f9fa',
    padding: 20,
    borderRadius: 15,
  },
  ratingText: {
    marginTop: 5,
    fontSize: 14,
    color: '#34495e',
    fontWeight: '600',
  },
  inputSection: {
    marginBottom: 30,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 10,
  },
  textInput: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    color: '#2c3e50',
    borderWidth: 1,
    borderColor: '#e9ecef',
    minHeight: 120,
  },
  submitButton: {
    backgroundColor: '#2ecc71',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2ecc71',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  disabledButton: {
    backgroundColor: '#95a5a6',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default CreateReviewScreen;
// inside add-review.tsx
//import StarRating from '../../components/StarRating'; 

// Then use it in your render function:
//<StarRating rating={rating} onRatingChange={setRating} />