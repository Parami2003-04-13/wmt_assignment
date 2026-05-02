import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface StarRatingProps {
  maxStars?: number;
  rating: number;
  onRatingChange?: (rating: number) => void;
  size?: number;
  readonly?: boolean;
}

const StarRating: React.FC<StarRatingProps> = ({ 
  maxStars = 5, 
  rating, 
  onRatingChange,
  size = 32,
  readonly = false
}) => {
  return (
    <View style={styles.starContainer}>
      {[...Array(maxStars)].map((_, index) => {
        const starNumber = index + 1;
        return (
          <TouchableOpacity 
            key={starNumber} 
            onPress={() => !readonly && onRatingChange?.(starNumber)}
            disabled={readonly}
            activeOpacity={readonly ? 1 : 0.7}
          >
            <MaterialIcons
              name={starNumber <= rating ? "star" : "star-border"}
              size={size}
              color={starNumber <= rating ? "#FFD700" : "#BDC3C7"}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  starContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 10,
  },
});

export default StarRating;